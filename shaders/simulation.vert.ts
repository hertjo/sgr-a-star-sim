const source = `
// Vertex shader: pass plot-space position to the fragment shader.
// We assume <planeGeometry args={[120, 60]} /> so vertex \`position.xy\`
// already lies in [-60, 60] x [-30, 30] (units of r_g).

varying vec2 vPos;

void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export default source;
