#pragma once
#include "component.h"
#include "GameObject/game_object.h"
#include "Postfx/postfx.h"
class RayTracingScene : public PostFX, public ISaveable
{

public:

  static int c;
  int counter;
  RayTracingScene(Shader shader);
  void postfx_render() override;
  void postfx_unbind() override;
  void save() override;

};
void init_scene(vector<GameObjectPtr>&gameObjects);
