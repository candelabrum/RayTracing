#pragma once

#include "stbi/stb_image.h"

#include "common.h"
#include "math.h"
#include <vector>
#include <type_traits>

const  float vertices[] = 
{
    -0.5f, -0.5f, 0.0f,
    0.5f, -0.5f, 0.0f,
    0.0f, 0.5f, 0.0f
};

class VertexArrayObject
{
private:
  GLuint vertexArrayBufferObject;
  int numIndices;
  template<int i>
    void InitChannel() { }
  template<int i, typename T, typename... Channel>
  void InitChannel(const vector<T> &channel, Channel... channels)
  {
    if (channel.size())
    {
      GLuint arrayBuffer;
      glGenBuffers(1, &arrayBuffer);
      glBindBuffer(GL_ARRAY_BUFFER, arrayBuffer);
      glBufferData(GL_ARRAY_BUFFER, sizeof(T) * channel.size(), channel.data(), GL_STATIC_DRAW);
      glEnableVertexAttribArray(i);
      
      const int size = sizeof(T) / sizeof(channel[0][0]);
      static_assert(size <= 4);
      if (std::is_same<T, uvec4>::value) 
        glVertexAttribIPointer(i, size, GL_UNSIGNED_INT, 0, 0);
      else
        glVertexAttribPointer(i, size, GL_FLOAT, GL_FALSE, 0, 0);
    }
    InitChannel<i + 1>(channels...);
  }
//------------------------------my_code-----------------------
  unsigned int loadCubemap(vector<std::string> faces)
  {
    unsigned int textureID;
    glGenTextures(1, &textureID);
    glBindTexture(GL_TEXTURE_CUBE_MAP, textureID);
    int width, height, nrChannels;
    for (unsigned int i = 0; i < faces.size(); i++)
    {
        unsigned char *data = stbi_load(faces[i].c_str(), &width, &height,
            &nrChannels, 0);
        if (data)
        {
            glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB,
            width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
            stbi_image_free(data);
        }
        else
        {
            std::cout << "Cubemap failed to load at path: " << faces[i]
            << std::endl;
            stbi_image_free(data);
        }
    }
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S,
    GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T,
    GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R,
    GL_CLAMP_TO_EDGE);

    return textureID;
  }
  void make_cube_map()
  {
    const vector<std::string> textures_faces
    {
        "/home/pedashenko/Рабочий стол/CG/Template/OpenGLTemplate-main/Common/Sources/Mesh/cubemap/right.jpg",
        "/home/pedashenko/Рабочий стол/CG/Template/OpenGLTemplate-main/Common/Sources/Mesh/cubemap/left.jpg",
        "/home/pedashenko/Рабочий стол/CG/Template/OpenGLTemplate-main/Common/Sources/Mesh/cubemap/top.jpg",
        "/home/pedashenko/Рабочий стол/CG/Template/OpenGLTemplate-main/Common/Sources/Mesh/cubemap/bottom.jpg",
        "/home/pedashenko/Рабочий стол/CG/Template/OpenGLTemplate-main/Common/Sources/Mesh/cubemap/front.jpg",
        "/home/pedashenko/Рабочий стол/CG/Template/OpenGLTemplate-main/Common/Sources/Mesh/cubemap/back.jpg",
    };
    cubemapTexture = loadCubemap(textures_faces);
    
  }
//------------------------------end_my_code-------------------
public:
  unsigned VBO;
  unsigned VAO;
  unsigned int cubemapTexture;
  unsigned int texture;

  VertexArrayObject():
  vertexArrayBufferObject(0), numIndices(0)
  {}
  template<typename... Channel>
  VertexArrayObject(const vector<unsigned int> &indices, const Channel... channels)
  {
    //int channelCount = sizeof...(channels);
  
    glGenVertexArrays(1, &vertexArrayBufferObject);
    glBindVertexArray(vertexArrayBufferObject);

    InitChannel<0>(channels...);
  
    GLuint arrayIndexBuffer;
    glGenBuffers(1, &arrayIndexBuffer);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, arrayIndexBuffer);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices[0]) * indices.size(), indices.data(), GL_STATIC_DRAW);
 
    glBindVertexArray(0);
    numIndices = indices.size();
/* ----------------------------- my code ----------------------- */
/* -------------------------- load texture --------------------- */
    glGenTextures(1, &texture);
    glBindTexture(GL_TEXTURE_2D, texture);
    // set the texture wrapping/filtering options (on currently bound texture)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // load and generate the texture
    int width, height, nrChannels;
    unsigned char *data = stbi_load("/home/pedashenko/Рабочий стол/CG/Template/OpenGLTemplate-main/Common/Sources/Mesh/container.jpg", &width, &height,
            &nrChannels, 0);
    if (data)
    {
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB,
        GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);
    }
    else
    {
        std::cout << "Failed to load texture" << std::endl;
    }
    stbi_image_free(data);
/* ---------------------------cube-map--------------------------*/
    make_cube_map();
      /* 
    glGenVertexArrays(1, &VAO); 
    glGenBuffers(1, &VBO);

    glBindVertexArray(VAO);

    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices,
                                            GL_STATIC_DRAW);

    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 3*sizeof(float),
                                                        (void*)0);

    glEnableVertexAttribArray(1); */
/* ---------------------------- end my code ---------------------*/


  }
  void render(bool wire_frame = false)
  {
    glBindVertexArray(vertexArrayBufferObject);
    glDrawElementsBaseVertex(wire_frame ? GL_LINES : GL_TRIANGLES, numIndices, GL_UNSIGNED_INT, 0, 0);
    glBindVertexArray(0);
/* ---------------------------- my code ---------------------------*/
/* --------------------------- textures ---------------------------*/
    glBindTexture(GL_TEXTURE_2D, texture);
/* ---------------------------- cube-map---------------------------*/
    glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture);
    /* 
    glBindVertexArray(VAO);
    //glDrawArrays(wire_frame ? GL_LINES : GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0, 0);
    glDrawArrays(GL_TRIANGLES, 0, 3);
    printf("HELP\n");*/
/* ----------------------------end my code ------------------------*/
  }
  void render_instances(int instance)
  {
    glBindVertexArray(vertexArrayBufferObject);
    glDrawElementsInstancedBaseVertex(GL_TRIANGLES, numIndices, GL_UNSIGNED_INT, 0, instance, 0);
    glBindVertexArray(0);
  }
  bool is_valid() const
  {
    return vertexArrayBufferObject > 0 && numIndices > 0;
  }
};
