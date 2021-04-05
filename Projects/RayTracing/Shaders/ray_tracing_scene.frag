#version 440

in vec2 fragUV;
out vec4 FragColor;

uniform mat4 ProjViewInv;
//uniform vec3 CameraPos;

uniform sampler2D London;
uniform samplerCube cubemap;


#define FAR_INF 1e9
#define EPS 1e-4
#define RAY_DEPTH 7
#define STACK_SIZE 130
const float INF = 1e10;

const int EMISSION = 0;
const int DIFFUSE = 1;
const int REFLECTION = 2;
const int REFRACTION = 3;

const float pi = acos(-1.);
const float phi = (1.+sqrt(5.))*.5;
const vec3 CAMERA_POS = vec3(0, 1.2, -6);


vec3 LIGHT1_POS = vec3(-3, 3, 3);
vec3 LIGHT1_COLOR = vec3(1, 1, 1);
int LIGHT1_MATERIALTYPE = EMISSION;
float LIGHT1_SCALE = 0.5;

vec3 LIGHT2_POS = vec3(1, 2, -3);
vec3 LIGHT2_COLOR = vec3(0.1, 1, 1);
int LIGHT2_MATERIALTYPE = EMISSION;
float LIGHT2_SCALE = 0.25;

vec3 LIGHT3_POS = vec3(0, 0, 0);
vec3 LIGHT3_COLOR = vec3(0.1, 1, 1);
int LIGHT3_MATERIALTYPE = REFLECTION;
float LIGHT3_SCALE = 0.5;

struct Collision
{
    float t;
    vec3 color;
    int materialType;
    vec3 n;
    bool hit;
    vec3 pos;
};

Collision light1 = Collision(INF, LIGHT1_COLOR, LIGHT1_MATERIALTYPE);
Collision light2 = Collision(INF, LIGHT2_COLOR, LIGHT2_MATERIALTYPE);
Collision light3 = Collision(INF, LIGHT3_COLOR, LIGHT3_MATERIALTYPE);

struct Ray
{
    vec3 pos, dir;
//    float transparent;
//    int depth;
};

struct Dodecahedron
{
    vec3 pos;
    float scale;
    int materialType;
};

Dodecahedron d1 = Dodecahedron(LIGHT1_POS, LIGHT1_SCALE, EMISSION);
Dodecahedron d2 = Dodecahedron(LIGHT2_POS, LIGHT2_SCALE, EMISSION);
Dodecahedron d3 = Dodecahedron(LIGHT3_POS, LIGHT3_SCALE, REFLECTION);


/* ---------------------magic with dodecahedron-------------------*/

vec2 rotate(vec2 a, float b)
{
    float c = cos(b);
    float s = sin(b);
    return vec2(
        a.x * c - a.y * s,
        a.x * s + a.y * c
    );
}

float scene(vec3 p, float scale)
{
    const vec3 n = normalize(vec3(phi,1,0));

    p = abs(p);
	float a = dot(p,n.xyz);
    float b = dot(p,n.zxy);
    float c = dot(p,n.yzx);
    return max(max(a,b),c) - scale * phi * n.y;
}

void trace(Ray ray, float scale, out Collision coll)
{
    vec3 accum = vec3(1);
    vec3 cam = ray.pos;
    vec3 viewVec = ray.dir;
    vec3 dir = viewVec;

    for(int bounce=0;bounce<3;++bounce)
    {
        float t = -0.0;
        float k;
        for(int i=0;i<100;++i)
        {
            k = scene(cam+dir*t, scale);
            t += k;
            if (k < .001 || k > 10.)
                break;
        }

        vec3 h = cam+dir*t;
        vec2 o = vec2(.001, 0);
        vec3 n = normalize(vec3(
            scene(h+o.xyy, scale)-scene(h-o.xyy, scale),
            scene(h+o.yxy, scale)-scene(h-o.yxy, scale),
            scene(h+o.yyx, scale)-scene(h-o.yyx, scale)
        ));

        coll.pos = cam + dir * t;
        coll.n = n;
        coll.hit = true;
        coll.t = t;

        if (k > 10.)
        {
            coll.hit = false;
            coll.color = vec3(1);
            coll.t = INF;
        }
        else
        {
            //return pow(light * fakeAO * accum * color, vec3(.4545));
            coll.color = normalize(abs(cross(h, n)));
        }
    }
    //coll.color = vec3(0);
}

Collision get_dodecahedron_coll(Dodecahedron d, Ray ray)
{
    Collision coll;

    coll.materialType = d.materialType;

    //ray.pos.yz = rotate(ray.pos.yz, .5);
    //ray.dir.yz = rotate(ray.dir.yz, .5);

    //ray.pos.xz = rotate(ray.pos.xz, 1.2);
    //ray.dir.xz = rotate(ray.dir.xz, 1.2);

    ray.pos = ray.pos - d.pos;

    trace(ray, d.scale, coll);

    return coll;
}

/* ---------------------end magic dodecahedron---------------------*/

Ray get_ray(vec2 uv)
{
    vec3 front = normalize(-CAMERA_POS);
    vec3 up = vec3(0, 1, 0);
    vec3 right = normalize(cross(front, up));
    up = normalize(cross(right, front));
    vec3 viewVec = normalize(front + right * uv.x + up * uv.y); 
    //--------------------------Street Raycing------------------
    
    return Ray(CAMERA_POS, viewVec);
}

float tracePlane(Ray ray, out vec3 normal)
{
    float t = (-1.0 - ray.pos.y) / ray.dir.y;

    if (t <= 0.0)
    {
        return INF;
    }
    vec3 worldPos = t * ray.dir + ray.pos;

    if (dot(worldPos.xz, worldPos.xz) >= 100.0)
    {
        return INF;
    }
    normal = vec3(0, 1, 0);

    return t;
}

Collision get_best_collision(Ray ray, out vec3 normal) 
{
    float planeT = tracePlane(ray, normal);
    Collision coll;
    coll.t = INF;

    if (planeT < coll.t)
    {
        if (coll.t == INF)
        {
            coll.hit = true;
        }
        else
        {
            coll.hit = false;
        }


        coll.t = planeT;
        coll.materialType = DIFFUSE;
        coll.n= vec3(0, 1, 0);

        vec3 worldPos = coll.t * ray.dir+ ray.pos;

        coll.color = texture(London, worldPos.xz * 0.1).rgb;
    }

    return coll;
}

vec3 computeLight(vec3 pos, vec3 color, vec3 normal)
{
    vec3 toLight1 = LIGHT1_POS - pos;
    float distSq1 = dot(toLight1, toLight1);
    float att1 = 20.0f / distSq1;
    
    vec3 toLight2 = LIGHT2_POS - pos;
    float distSq2 = dot(toLight2, toLight2);
    float att2 = 10.0f / distSq2;

    
    return color * (
        max(0.0, dot(normal, normalize(toLight1))) * att1 * LIGHT1_COLOR
        + max(0.0, dot(normal, normalize(toLight2))) * att2 * LIGHT2_COLOR
         + texture(cubemap, normal).rgb * 0.1
    );
}

Collision set_next_collision(in Collision coll, in Collsion new_coll,
                                            in Collision object)
{
    if (new_coll.t  < coll.t)
    {
        coll.t = new_coll.t;
        coll.n = new_coll.n;
        coll.color = object.color;
        coll.materialType = object.materialType;
    }

    return coll;
}

    

void ray_cast(Ray ray, out vec4 FragUV)
{
    vec3 viewVec = ray.dir;

    for (int i = 0; i < 10; i++)
    {
        Collision coll;
        
        coll.t = INF;
        
        coll = get_best_collision(ray, coll.n);

        FragUV = vec4(coll.color, 1);
        
        Collision new_coll = get_dodecahedron_coll(d1, ray);
        float light1T = new_coll.t;

        if (light1T < coll.t)
        {
            coll.t = light1T;
            coll.materialType = EMISSION;
            coll.color = LIGHT1_COLOR;
            coll.n = new_coll.n;
            
            //FragUV = vec4(coll.color, 1);
            FragUV = vec4(coll.color, 1);
        }

        new_coll = get_dodecahedron_coll(d2, ray);
        float light2T = new_coll.t;
        if (light2T < coll.t)
        {
            coll.t = light2T;
            coll.materialType = EMISSION;
            coll.color = LIGHT2_COLOR;
            coll.n = new_coll.n;
            
            //FragUV = vec4(coll.color, 1);
            FragUV = vec4(coll.color, 1);
        }

        new_coll = get_dodecahedron_coll(d3, ray);
        float light3T = new_coll.t;
        if (light3T < coll.t)
        {
            coll.t = light3T;
            coll.materialType = REFLECTION;
            coll.n = new_coll.n;
            
            //FragUV = vec4(coll.color, 1);
            //FragUV = vec4(coll.color, 1);
        }

        if (coll.t != INF)
        {
            vec3 worldPos = coll.t * ray.dir+ ray.pos;

            if (coll.materialType == EMISSION)
            {
               //FragUV = vec4(coll.color, 1);
               FragUV = vec4(coll.color, 1);
               break;
            } else if (coll.materialType == DIFFUSE)
            {
                FragUV = vec4(computeLight(worldPos, coll.color,
                                                    coll.n), 1);
                break;
            } 

        }
        else 
        {
            FragUV = vec4(0, 0, 0, 1);
        }
    }
}

void main()
{ 
//-----------------------------make ViewVec ----------------

    Ray ray = get_ray(fragUV);
        
//------------------------loop for tracing-----------------

    ray_cast(ray, FragColor);

}
