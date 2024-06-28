// # Orbital Overture
// _An interactive screensaver_
// Go to the site: [Orbital Overture](https://jfeching.github.io/161_interactive_screensaver/)
// `CMSC 161 B-1L`
// ## Attributions
// `format: LastName, GivenName Initial | Student number`
// * Ching, John Francis Benjamin E. | 2020-11202
// * Jimenez, Christoper Marlo G. | 2020-05310
// * Rayel, Carlos Angelo L. | 2019-06913
// The program is an interactive screensaver project created in fulfilment of the requirements of CMSC 161
// section B-1L, 2nd Semester AY 2022-2023. It is a WebGL program with a custom renderer
// made to depict an interactive solar system screensaver.

"use strict";

// This is not a full .obj parser.
// see http://paulbourke.net/dataformats/obj/

function parseOBJ(text) {
  // because indices are base 1 let's just fill in the 0th moon1Data
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];

  // same order as `f` indices
  const objVertexData = [objPositions, objTexcoords, objNormals];

  // same order as `f` indices
  let webglVertexData = [
    [], // positions
    [], // texcoords
    [], // normals
  ];

  // function newGeometry() {
  //   // If there is an existing geometry and it's
  //   // not empty then start a new one.
  //   if (geometry && geometry.moon1Data.position.length) {
  //     geometry = undefined;
  //   }
  //   setGeometry();
  // }

  function addVertex(vert) {
    const ptn = vert.split("/");
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
    });
  }

  const keywords = {
    v(parts) {
      objPositions.push(parts.map(parseFloat));
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      // should check for missing v and extra w?
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split("\n");
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn("unhandled keyword:", keyword); // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  return {
    position: webglVertexData[0],
    texcoord: webglVertexData[1],
    normal: webglVertexData[2],
  };
}

function parseMTL(text) {
  const materials = {};
  let material;

  const keywords = {
    newmtl(parts, unparsedArgs) {
      material = {};
      materials[unparsedArgs] = material;
    },
    /* eslint brace-style:0 */
    Ns(parts) {
      material.shininess = parseFloat(parts[0]);
    },
    Ka(parts) {
      material.ambient = parts.map(parseFloat);
    },
    Kd(parts) {
      material.diffuse = parts.map(parseFloat);
    },
    Ks(parts) {
      material.specular = parts.map(parseFloat);
    },
    Ke(parts) {
      material.emissive = parts.map(parseFloat);
    },
    Ni(parts) {
      material.opticalDensity = parseFloat(parts[0]);
    },
    d(parts) {
      material.opacity = parseFloat(parts[0]);
    },
    illum(parts) {
      material.illum = parseInt(parts[0]);
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split("\n");
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn("unhandled keyword:", keyword); // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  return materials;
}

function getRandomFloat(min, max, decimals) {
  const str = (Math.random() * (max - min) + min).toFixed(decimals);
  return parseFloat(str);
}

//will update the colors of the spheres
function updateColor(colors, addends) {
  for (let i = 0; i < colors.length; i++) {
    // get the length of the inner array elements
    let innerArrayLength = colors[i].length;

    // looping inner array elements
    for (let j = 0; j < innerArrayLength - 1; j++) {
      if (colors[i][j] >= 1.0 || colors[i][j] <= 0.0) addends[i][j] *= -1;
      colors[i][j] += addends[i][j];
      addends[i][j] += getRandomFloat(-0.0001, 0.0001, 4);
      if (addends[i][j] == 0.1 || addends[i][j] == -0.1) addends[i][j] = 0.001;
    }
  }
}
function setCameraPos(num, camera, tid, isTopView) {
  camera[1] += num;
  if (camera[1] == 0 || camera[1] == 10) {
    if (camera[1] == 0) isTopView[0] = false;
    else if (camera[1] == 10) isTopView[0] = true;
    isTopView[1] = false;
    clearInterval(tid);
  }
}

async function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#output");
  const gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  /**UPDATE:
   * - u_projection and u_view combined into u_matrix
   */

  const vs = `
    attribute vec4 a_position;
    attribute vec3 a_normal;
    attribute vec4 a_color;

    uniform mat4 u_projection;
    uniform mat4 u_view;
    uniform mat4 u_world;
    uniform vec3 u_viewWorldPosition;

    varying vec3 v_normal;
    varying vec3 v_surfaceToView;
    varying vec4 v_color;

    void main() {
      vec4 worldPosition = u_world * a_position;
      gl_Position = u_projection * u_view * worldPosition;
      v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;
      v_normal = mat3(u_world) * a_normal;
      v_color = a_color;
    }
    `;

  const smoothVs = `
  attribute vec4 a_position;
  attribute vec3 a_normal;

  uniform mat4 u_matrix;
  uniform mat4 u_transformation;
  uniform mat4 u_world;

  varying vec3 v_normal;

  void main() {
    gl_Position = u_transformation * u_matrix * a_position;
    v_normal = mat3(u_world) * a_position.xyz;
  }
  `;

  const fs = `
    precision highp float;

    varying vec3 v_normal;
    varying vec3 v_surfaceToView;
    varying vec4 v_color;

    uniform vec3 diffuse;
    uniform vec3 ambient;
    uniform vec3 emissive;
    uniform vec3 specular;
    uniform float shininess;
    uniform float opacity;
    uniform vec3 u_lightDirection;
    uniform vec3 u_ambientLight;

    void main () {
      vec3 normal = normalize(v_normal);

      vec3 surfaceToViewDirection = normalize(v_surfaceToView);
      vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

      float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
      float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);

      vec3 effectiveDiffuse = diffuse * v_color.rgb;
      float effectiveOpacity = opacity * v_color.a;

      gl_FragColor = vec4(
          emissive +
          ambient * u_ambientLight +
          effectiveDiffuse * fakeLight +
          specular * pow(specularLight, shininess),
          effectiveOpacity);
    }
    `;

  // compiles and links the shaders, looks up attribute and uniform locations
  // Regular cube-like normals
  // const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);
  // Smooth lighting normals
  const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);
  console.log("is error?");

  // Pochacco
  const pochacco = await fetch(
    "https://raw.githubusercontent.com/rnarlo/hi_pochacco/master/src/object_files/pochacco.obj",
  );
  const pochaccoText = await pochacco.text();
  const pochaccoData = parseOBJ(pochaccoText);

  // Because moon1Data is just named arrays like this
  //
  // {
  //   position: [...],
  //   texcoord: [...],
  //   normal: [...],
  // }
  //
  // and because those names match the attributes in our vertex
  // shader we can pass it directly into `createBufferInfoFromArrays`
  // from the article "less code more fun".

  // create a buffer for each array by calling
  // gl.createBuffer, gl.bindBuffer, gl.bufferData
  const pochaccoBufferInfo = webglUtils.createBufferInfoFromArrays(
    gl,
    pochaccoData,
  );
  // const planetBufferInfo = webglUtils.createBufferInfoFromArrays(
  //   gl,
  //   planetData,
  // );

  let transformationMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  const cameraTarget = [0, 0, 0];
  const cameraPosition = [0, 0, 10];
  const zNear = 0.1;
  const zFar = 50;
  const up = [0, 1, 0];

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }
  let speedslider = document.getElementById("speed");
  let speed_text = document.getElementById("speed_mult");
  let speed_mult = 1;

  let ldx = 1.0,
    ldy = 1.0,
    ldz = 1.0;
  let colors = [
    [1, 0.7, 0.5, 1],
    [1, 0.7, 0.5, 1],
    [1, 0.7, 0.5, 1],
  ];
  let addends = [
    [0.001, 0.001, 0.001, 0],
    [0.001, 0.001, 0.001, 0],
    [0.001, 0.001, 0.001, 0],
  ];

  let scaleslider = document.getElementById("scale");
  let scale_text = document.getElementById("scale_mult");
  let scale_mult = 1;

  //sliders for light direction
  let xldslider = document.getElementById("x-lightdir");
  let yldslider = document.getElementById("y-lightdir");
  let zldslider = document.getElementById("z-lightdir");
  let lidiroutput = document.getElementById("lidirVector");

  //sliders to change the speed parameters
  speedslider.oninput = function () {
    speed_mult = this.value / 10;
    speed_text.innerHTML = String(speedslider.value / 10);
  };

  //sliders to change the scale parameters
  scaleslider.oninput = function () {
    scale_mult = this.value / 10;
    transformationMatrix[0] = 1 * parseFloat(scale_mult);
    transformationMatrix[5] = 1 * parseFloat(scale_mult);
    scale_text.innerHTML = String(scaleslider.value / 10);
  };

  //sliders to change the light direction parameters (x y z)
  xldslider.oninput = function () {
    ldx = this.value / 10;
    lidiroutput.innerHTML =
      "x: " +
      String(xldslider.value / 10) +
      " y: " +
      String(yldslider.value / 10) +
      " z: " +
      String(zldslider.value / 10);
  };
  yldslider.oninput = function () {
    ldy = this.value / 10;
    lidiroutput.innerHTML =
      "x: " +
      String(xldslider.value / 10) +
      " y: " +
      String(yldslider.value / 10) +
      " z: " +
      String(zldslider.value / 10);
  };
  zldslider.oninput = function () {
    ldz = this.value / 10;
    lidiroutput.innerHTML =
      "x: " +
      String(xldslider.value / 10) +
      " y: " +
      String(yldslider.value / 10) +
      " z: " +
      String(zldslider.value / 10);
  };

  //listens to keyboard events
  let sliders = document.getElementById("sliders");
  let credits = document.getElementById("credits");
  var isTopView = [false, false];
  let tid;
  document.addEventListener(
    "keydown",
    (event) => {
      //Press T to move the camera position to "top view"
      if (event.key == "T" || event.key == "t") {
        if (!isTopView[0] && !isTopView[1]) {
          isTopView[1] = true;
          tid = setInterval(function () {
            setCameraPos(1, cameraPosition, tid, isTopView);
          }, 25);
          //cameraPosition[1] = 10;
          //isTopView[0] = true;
        } else if (isTopView[0] && !isTopView[1]) {
          isTopView[1] = true;
          tid = setInterval(function () {
            setCameraPos(-1, cameraPosition, tid, isTopView);
          }, 25);
          //cameraPosition[1] = 0;
          //isTopView[0] = false;
        }
        //WASD for translation
      } else if (event.key == "A" || event.key == "a") {
        transformationMatrix[12] -= 0.1;
      } else if (event.key == "D" || event.key == "d") {
        transformationMatrix[12] += 0.1;
      } else if (event.key == "W" || event.key == "w") {
        transformationMatrix[13] += 0.1;
      } else if (event.key == "S" || event.key == "s") {
        transformationMatrix[13] -= 0.1;
      } else if (event.key == "O" || event.key == "o") {
        if (sliders.classList.contains("invisibleO")) {
          sliders.classList.remove("invisibleO");
          credits.classList.remove("invisibleC");

          // for the initial loading of the page
          sliders.classList.remove("invisible");
          credits.classList.remove("invisible");
        } else {
          sliders.classList.add("invisibleO");
          credits.classList.add("invisibleC");
        }
      } else if (event.key == " ") {
        // press spacebar randomized the colors of the objects
        for (let i = 0; i < colors.length; i++) {
          // get the length of the inner array elements
          let innerArrayLength = colors[i].length;

          // looping inner array elements
          for (let j = 0; j < innerArrayLength - 1; j++) {
            colors[i][j] = getRandomFloat(0, 1, 2);
          }
        }
      }
    },
    false,
  );

  for (let i = 0; i < colors.length; i++) {
    // get the length of the inner array elements
    let innerArrayLength = colors[i].length;

    // looping inner array elements
    for (let j = 0; j < innerArrayLength - 1; j++) {
      colors[i][j] = getRandomFloat(0, 1, 2);
    }
  }

  /**Compute matrix
   * - basically ensures that the object is revolving correctly
   */
  function computeMatrix(viewProjectionMatrix, translation, Rotate, Revolve) {
    var matrix = viewProjectionMatrix;
    matrix = m4.yRotate(matrix, Revolve);
    matrix = m4.translate(
      matrix,
      translation[0],
      translation[1],
      translation[2],
    );
    matrix = m4.yRotate(matrix, Rotate);
    return matrix;
  }
  if (cameraPosition[1] == 0 || cameraPosition[1] == 10) {
    clearInterval(tid);
  }
  // var moon1Distance = 4;
  // var moon2Distance = 6;

  function render(time) {
    time *= 0.001 * speed_mult; // convert to seconds\

    // Resizing canvas and enabling options
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const fieldOfViewRadians = degToRad(60);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);

    // Make a view matrix from the camera matrix.
    const view = m4.inverse(camera);

    gl.useProgram(meshProgramInfo.program);

    // Compute viewProjectionMatrix
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);
    const viewProjectionMatrix = m4.multiply(projection, view);

    updateColor(colors, addends);

    /**
     * PLANET
     * Procedure is same except no translate and revolve
     */
    // var planetTranslate = [0, 0, 0];
    // var planetRotate = -time;
    // var planetRevolve = 0;

    // const planetUniforms = {
    //   u_lightDirection: m4.normalize([-1, 3, 5]),
    //   u_matrix: computeMatrix(
    //     viewProjectionMatrix,
    //     planetTranslate,
    //     planetRotate,
    //     planetRevolve,
    //   ),
    // };

    // webglUtils.setUniforms(meshProgramInfo, planetUniforms);
    // webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, planetBufferInfo);
    // webglUtils.setUniforms(meshProgramInfo, {
    //   u_world: m4.multiply(
    //     m4.yRotation(planetRotate),
    //     m4.yRotation(planetRevolve),
    //   ),
    //   u_diffuse: colors[2],
    //   u_lightDirection: [ldx, ldy, ldz],
    //   u_transformation: transformationMatrix,
    // });

    // webglUtils.drawBufferInfo(gl, planetBufferInfo);

    /**
     * Pochacco
     * Procedure is same except no translate and revolve
     */
    var pochaccoTranslate = [0, 0, 0];
    var pochaccoRotate = -time;
    var pochaccoRevolve = 0;

    const pochaccoUniforms = {
      u_lightDirection: m4.normalize([-1, 3, 5]),
      u_matrix: computeMatrix(
        viewProjectionMatrix,
        pochaccoTranslate,
        pochaccoRotate,
        pochaccoRevolve,
      ),
    };

    webglUtils.setUniforms(meshProgramInfo, pochaccoUniforms);
    webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, pochaccoBufferInfo);
    webglUtils.setUniforms(meshProgramInfo, {
      u_world: m4.multiply(
        m4.yRotation(pochaccoRotate),
        m4.yRotation(pochaccoRevolve),
      ),
      u_diffuse: colors[2],
      u_lightDirection: [ldx, ldy, ldz],
      u_transformation: transformationMatrix,
    });

    webglUtils.drawBufferInfo(gl, pochaccoBufferInfo);

    // loops the animation
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
