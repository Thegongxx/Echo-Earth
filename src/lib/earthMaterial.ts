import * as THREE from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-p.xyz);
    gl_Position = projectionMatrix * p;
  }
`;

/** Camera-relative studio lighting keeps every continent readable while dragging. */
export function earthMaterial(texture: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      edgeColor: { value: new THREE.Color("#1d6892") },
    },
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 edgeColor;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 eye = normalize(vView);
        vec3 light = normalize(vec3(-0.45, 0.65, 1.0));
        vec3 base = texture2D(map, vUv).rgb;
        float facing = max(dot(n, eye), 0.0);
        float diffuse = max(dot(n, light), 0.0);
        float rim = pow(1.0 - facing, 3.5);
        float ocean = smoothstep(0.025, 0.14, base.b - base.r);
        float glint = pow(max(dot(n, normalize(light + eye)), 0.0), 36.0);
        vec3 color = base * (0.45 + 0.70 * diffuse);
        color += vec3(0.11, 0.19, 0.21) * glint * ocean * 0.22;
        color = mix(color, edgeColor, rim * 0.30);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function atmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color("#66c9f1") } },
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        float glow = pow(1.0 - facing, 4.5);
        gl_FragColor = vec4(color, glow * 0.42);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
