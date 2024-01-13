#version 300 es

layout(location=0) in vec4 position;
layout(location=1) in vec4 color;

uniform mat4 u_ModelViewMatrix;
uniform mat4 u_ProjectionMatrix;

out vec4 vColor;

void main() {
    vColor = color;
    gl_Position =  u_ProjectionMatrix * u_ModelViewMatrix * position;
}