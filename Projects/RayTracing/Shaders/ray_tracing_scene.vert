#version 440
layout(location = 0)in vec2 Position;
layout(location = 1)in vec2 T_Position;



out vec2 fragUV;
void main()
{
    fragUV = T_Position;
    gl_Position = vec4(T_Position, 0, 1);
}
