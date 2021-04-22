
import { EffectComposer } from "https://unpkg.com/three@0.120.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://unpkg.com/three@0.120.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://unpkg.com/three@0.120.0/examples/jsm/postprocessing/UnrealBloomPass.js";



var options = {
  exposure: 2.8,
  bloomStrength: 1.7,
  bloomThreshold: 0,
  bloomRadius: 0.8,
  color0: [74, 30, 0], // CSS string
  color1: [201, 158, 72], // RGB array
};
var gui = new dat.GUI();

var bloom = gui.addFolder("Bloom");
// bloom.add(options, "exposure", 0.0, 5.0).name("exposure").listen();
bloom.add(options, "bloomStrength", 0.0, 5.0).name("bloomStrength").listen();
// bloom.add(options, "bloomThreshold", 0.0, 1.0).name("bloomThreshold").listen();
bloom.add(options, "bloomRadius", 0.1, 2.0).name("bloomRadius").listen();
bloom.open();
gui.close()
var color = gui.addFolder("Colors");
color.addColor(options, "color0").name("Border");
color.addColor(options, "color1").name("Base");
color.open();

const vert = `
      varying vec3 vNormal;
      void main() {
        	vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }

`;

const frag = `
      #define NUM_OCTAVES 5
      uniform vec4 resolution;
      uniform vec3 color1;
      uniform vec3 color0;
      uniform float time;
      varying vec3 vNormal;

      float rand(vec2 n) {
        return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
      }

      float noise(vec2 p){
        vec2 ip = floor(p);
        vec2 u = fract(p);
        u = u*u*(3.0-2.0*u);

        float res = mix(
          mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
          mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
        return res*res;
      }

      float fbm(vec2 x) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100);
        // Rotate to reduce axial bias
          mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
        for (int i = 0; i < NUM_OCTAVES; ++i) {
          v += a * noise(x);
          x = rot * x * 2.0 + shift;
          a *= 0.5;
        }
        return v;
      }

      vec3 rgbcol(float r, float g, float b) {
        return vec3(r/255.0,g/255.0,b/255.0);
      }

      float setOpacity(float r, float g, float b) {
        float tone = (r + g + b) / 3.0;
        float alpha = 1.0;
        if(tone<0.99) {
          alpha = 0.0;
        }
        return alpha;
      }

      void main()	{
       //this is for plane geometry
       //vec2 uv = gl_FragCoord.xy/resolution.xy ;

       vec2 uv = normalize( vNormal ).xy * 0.5 + 0.5; ;
       vec2 newUv = uv + vec2(0.0, -time*0.0004);
       float scale = 12.;
       vec2 p = newUv*scale;
       float noise = fbm( p + fbm( p ) );

       vec4 backColor = vec4(1.0 - uv.y) + vec4(vec3(noise*(1.0 - uv.y)),1.0);
       float aback = setOpacity(backColor.r,backColor.g,backColor.b);
       backColor.a = aback;
       backColor.rgb = rgbcol(color1.r,color1.g,color1.b);

       vec4 frontColor = vec4(1.08 - uv.y) + vec4(vec3(noise*(1.0 - uv.y)),1.0);
       float afront = setOpacity(frontColor.r,frontColor.g,frontColor.b);
       frontColor.a = afront ;
       frontColor.rgb = rgbcol(color0.r,color0.g,color0.b);

       // create edge
       frontColor.a = frontColor.a - backColor.a;

       if(frontColor.a>0.0){
        // show first color
        gl_FragColor = frontColor;
       } else {
        // show 2nd color
         gl_FragColor = backColor;
       }
      }

`;

var scene,
  camera,
  renderer,
  width = window.innerWidth,
  height = window.innerHeight,
  material,
  bloomPass,
  composer;
var uniforms = {
  time: {
    type: "f",
    value: 10.0,
  },
  resolution: {
    value: new THREE.Vector2(width, height),
  },
  color1: {
    value: new THREE.Vector3(...options.color1),
  },
  color0: {
    value: new THREE.Vector3(...options.color0),
  },
};

function init() {
  createScene();
  plane();
  animate();
}
function createScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 5;
  renderer = new THREE.WebGLRenderer();
  renderer.antialias = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  // renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // renderer.interpolateneMapping = THREE.ACESFilmicToneMapping;
  // renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById("world").appendChild(renderer.domElement);

  var renderScene = new RenderPass(scene, camera);

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,
    0.4,
    0.85
  );
  bloomPass.threshold = options.bloomThreshold;
  bloomPass.strength = options.bloomStrength;
  bloomPass.radius = options.bloomRadius;

  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);
}

function plane() {
  var spheregeometry = new THREE.SphereGeometry(1.7, 32, 32);
  material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    transparent: true,
    vertexShader: vert,
    fragmentShader: frag,
  });
  var plane = new THREE.Mesh(spheregeometry, material);
  scene.add(plane);
}
function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function animate(delta) {
  requestAnimationFrame(animate);
  material.uniforms.time.value = delta;
  material.uniforms.color1.value = new THREE.Vector3(...options.color1);
  material.uniforms.color0.value = new THREE.Vector3(...options.color0);

  bloomPass.threshold = options.bloomThreshold;
  bloomPass.strength = options.bloomStrength;
  bloomPass.radius = options.bloomRadius;
  composer.render();
}
init();
window.addEventListener("resize", handleResize, false);
