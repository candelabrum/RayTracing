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


vec3 LIGHT1_POS = vec3(0, 4, 0);
vec3 LIGHT1_COLOR = vec3(1, 1, 1);
int LIGHT1_MATERIALTYPE = EMISSION;
float LIGHT1_SCALE = 0.5;

vec3 LIGHT2_POS = vec3(0, 6, 0);
vec3 LIGHT2_COLOR = vec3(0, 1, 0);
int LIGHT2_MATERIALTYPE = EMISSION;
float LIGHT2_SCALE = 0.25;

vec3 LIGHT3_POS = vec3(0, 0, 0);
vec3 LIGHT3_COLOR = vec3(0.1, 1, 1);
int LIGHT3_MATERIALTYPE = REFLECTION;
//int LIGHT3_MATERIALTYPE = REFRACTION;
float LIGHT3_SCALE = 1;

struct Collision
{
    float t;
    vec3 color;
    int materialType;
    vec3 n;
    bool hit;
    vec3 pos;
};

struct Object
{
    vec3 color;
    int materialType;
};

Object light1 = Object(LIGHT1_COLOR, LIGHT1_MATERIALTYPE);
Object light2 = Object(LIGHT2_COLOR, LIGHT2_MATERIALTYPE);
Object light3 = Object(LIGHT3_COLOR, LIGHT3_MATERIALTYPE);

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
Dodecahedron d3 = Dodecahedron(LIGHT3_POS, LIGHT3_SCALE,
                                    LIGHT3_MATERIALTYPE);


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

    //ray.pos.yz = rotate(ray.pos.yz, 0.);
    //ray.dir.yz = rotate(ray.dir.yz, 0.);

    //ray.pos.xz = rotate(ray.pos.xz, 0.5);
    //ray.dir.xz = rotate(ray.dir.xz, 0.5);

    ray.pos = ray.pos - d.pos;

    trace(ray, d.scale, coll);

    //ray.pos.yz = rotate(ray.pos.yz, 0.);
    //ray.dir.yz = rotate(ray.dir.yz, 0.);

    //ray.pos.xz = rotate(ray.pos.xz, -0.5);
    //ray.dir.xz = rotate(ray.dir.xz, -0.5);

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
    float t = (-1.2 - ray.pos.y) / ray.dir.y;

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

float traceCylinder(vec3 pos, vec3 dir, out vec3 normal)
{
    float t = (-1.0 - pos.y) / dir.y;
    if (t <= 0.0) {
        return INF;
    }
    vec3 worldPos = t * dir + pos;
    if (dot(worldPos.xz, worldPos.xz) < 0.5) {
        normal = vec3(0, 1, 0);
        return t;
    }

    // dot(pos + t * dir, pos + t * dir) == r * r;
    // dot(pos, pos) + 2 * t * dot(pos, dir) + t * t * dot(dir, dir) == r * r
    // t * t + 2.0 * t * dot(pos, dir) + dot(pos, pos) - r * r == 0
    float a = dot(dir.xz, dir.xz);
    float b = dot(pos.xz, dir.xz);
    float c = dot(pos.xz, pos.xz) - 0.5;
    float D = b * b - a * c;
    if (D < 0.0) {
        return INF;
    }
    t = (-b - sqrt(D)) / a;
    if (t > 0.0) {
        worldPos = t * dir + pos;
        if (worldPos.y <= -1.0) {
            normal = normalize(vec3(worldPos.x, 0, worldPos.z));
            return t;
        }
    }
    t = (-b + sqrt(D)) / a;
    if (t < 0.0) {
        return INF;
    }
    worldPos = t * dir + pos;
    if (worldPos.y <= -1.0) {
        normal = normalize(vec3(worldPos.x, 0, worldPos.z));
        return t;
    }
    return INF;
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
        coll.n= normal;

        vec3 worldPos = coll.t * ray.dir+ ray.pos;

        coll.color = texture(London, worldPos.xz).rgb;
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
         + 0.1*texture(cubemap, normal).rgb
    );
}

Collision set_next_coll(Collision coll, Collision new_coll,
                                            Object object)
{
    if (new_coll.t  < coll.t)
    {
        coll.t = new_coll.t;
        coll.n = new_coll.n;
        if (object.materialType == EMISSION ||
                object.materialType == DIFFUSE)
            coll.color = object.color;
        coll.materialType = object.materialType;
    }

    return coll;
}

vec3 refraction(vec3 v, vec3 normal, float n1, float n2)
{
    if (dot(v, normal) < 0.0)
    {
        normal = -normal;
    }
    float cosA = dot(v, normal);
    float sinA = sqrt(1.0 - cosA * cosA);

    vec3 tang = normalize(v - cosA * normal);

    float sinB = sinA / n2 * n1;
    float cosB = sqrt(1.0 - sinB * sinB);
    
    return sinB * tang + cosB * normal;
}

void ray_cast(Ray ray, out vec4 FragUV)
{
    vec3 viewVec = ray.dir;

    const float GLASS_N = 1.5;
    const float AIR_N = 1.0;
    
    float n1 = AIR_N;
    float n2 = GLASS_N;

    for (int i = 0; i < 10; i++)
    {
/* ------------------------------Plane---------------------------*/
        Collision coll;
        
        coll.t = INF;
        
        vec3 worldPos = coll.t * ray.dir+ ray.pos;

        coll = get_best_collision(ray, coll.n);
        coll.color = vec4(1, 1, 0, 1).rgb;
        //coll.color = texture(cubemap, vec3(ray.dir.x, -ray.dir.y,  ray.dir.z)).rgb;
        coll.color = texture(cubemap, vec3(ray.dir.x, ray.dir.y,  ray.dir.z)).rgb;

        FragUV = texture(cubemap, vec3(ray.dir.x, ray.dir.y, ray.dir.z));
        //FragUV = texture(cubemap, vec3(ray.dir.x, -ray.dir.y, 2*ray.dir.z));
        
        //FragUV = vec4(1, 1, 0, 1);

        //FragUV = vec4(coll.color, 1);

/* ----------------------------end_Plane--------------------------*/
/*-----------------------------light1-----------------------------*/
        
        Collision new_coll = get_dodecahedron_coll(d1, ray);
        coll = set_next_coll(coll, new_coll, light1);

        FragUV = vec4(coll.color, 1); 
/*----------------------------end_light1---------------------------*/
/*-----------------------------light2------------------------------*/

        new_coll = get_dodecahedron_coll(d2, ray);
        coll = set_next_coll(coll, new_coll, light2);

        FragUV = vec4(coll.color, 1);
/*----------------------------end_light2----------------------------*/
/*----------------------------light3--------------------------------*/

        new_coll = get_dodecahedron_coll(d3, ray);
        coll = set_next_coll(coll, new_coll, light3);
        coll.materialType = REFLECTION;
        coll.n = new_coll.n;

        //FragUV = vec4(coll.color, 1);
        //FragUV = vec4(coll.n, 1);

/*---------------------------end_light3-----------------------------*/
/*---------------------------cylinder-------------------------------*/
        vec3 cylNorm;

        float cylT = traceCylinder(ray.pos, ray.dir, cylNorm);
        if (cylT < coll.t) 
        {
            coll.t = cylT;
            coll.materialType = DIFFUSE;
            vec3 worldPos = coll.t * ray.dir+ ray.pos;
            //coll.color = texture(iChannel2, worldPos.xz * worldPos.y).rgb;
            coll.color = texture(cubemap, vec3(worldPos.xz*worldPos.y, 1)).rgb;
            //coll.color = vec3(0, 1, 0);
            coll.n = cylNorm;
        }

        if (coll.t != INF)
        {
            vec3 worldPos = coll.t * ray.dir+ ray.pos;

            if (coll.materialType == EMISSION)
            {
               FragUV = vec4(coll.color, 1);
               break;
            } else if (coll.materialType == DIFFUSE)
            {
                FragUV = vec4(computeLight(worldPos, coll.color,
                                                    coll.n), 1);
                break;
            } else if (coll.materialType == REFLECTION)
            {
                ray.pos = worldPos + 0.00001*ray.dir;
                ray.dir = reflect(ray.dir, coll.n);
            }    
            else if (coll.materialType == REFRACTION)
            {
                float tmp = n1;

                ray.dir = normalize(refraction(ray.dir, coll.n, n1, n2));
                //ray.dir = normalize(refract(ray.dir, coll.n, n1/n2));
                ray.pos = worldPos; //+ ray.dir * 0.00001;

                n1 = n2;
                n2 = tmp;
            }
        }
        else 
        {
            FragUV = vec4(texture(cubemap, ray.dir));
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
