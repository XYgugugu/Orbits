/**
 * 
 * @param {*} vs_source path to vertex shader source
 * @param {*} fs_source path to fragment shader source
 * @returns a program with vs and fs linked
 */
function compileShader(vs_source, fs_source) {
    const vs = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vs, vs_source)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(vs))
        throw Error("Vertex shader compilation failed")
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fs, fs_source)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fs))
        throw Error("Fragment shader compilation failed")
    }

    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program))
        throw Error("Linking shaders failed")
    }

    // loop through all uniforms in the shader source code
    // get their locations and store them in the GLSL program object for later use
    const uniforms = {}
    for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i+=1) {
        let info = gl.getActiveUniform(program, i)
        uniforms[info.name] = gl.getUniformLocation(program, info.name)
    }
    program.uniforms = uniforms
    return program
}

/**
 * Sends per-vertex data to the GPU and connects it to a VS input
 * 
 * @param data    a 2D array of per-vertex data (e.g. [[x,y,z,w],[x,y,z,w],...])
 * @param loc     the layout location of the vertex shader's `in` attribute
 * @param mode    (optional) gl.STATIC_DRAW, gl.DYNAMIC_DRAW, etc
 * 
 * @returns the ID of the buffer in GPU memory; useful for changing data later
 */
function supplyDataBuffer(data, loc, mode) {
    if (mode === undefined) mode = gl.STATIC_DRAW
    
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    const f32 = new Float32Array(data.flat())
    gl.bufferData(gl.ARRAY_BUFFER, f32, mode)
    
    gl.vertexAttribPointer(loc, data[0].length, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(loc)
    
    return buf;
}

/**
 * Creates a Vertex Array Object and puts into it all of the data in the given
 * JSON structure, which 'triangles', 'positions', and 'colors' in order
 * 
 * @returns an object with four keys:
 *  - mode = the 1st argument for gl.drawElements
 *  - count = the 2nd argument for gl.drawElements
 *  - type = the 3rd argument for gl.drawElements
 *  - vao = the vertex array object for use with gl.bindVertexArray
 */
function setupGeomery(geom) {
    var triangleArray = gl.createVertexArray()
    gl.bindVertexArray(triangleArray)

    let data = geom.positions
    supplyDataBuffer(data, 0)
    data = geom.colors
    supplyDataBuffer(data, 1)


    var indices = new Uint16Array(geom.triangles.flat())
    var indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

    return {
        mode: gl.TRIANGLES,
        count: indices.length,
        type: gl.UNSIGNED_SHORT,
        vao: triangleArray
    }
}

/**
 * Draw images with compiled vertex and fragment shaders using info retrieved from the geometry json file
 * Based on tick value, apply translation and rotation in certain degrees
 * @param {*} ms millisecond when the program is running
 */
function draw(t) {
    let Blue = new Float32Array([0.075,0.16,0.292,1])
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(program)
    //draw all octahedrons
    gl.bindVertexArray(ogeom.vao)
    drawSun(t)
    drawEarth(t)
    drawMars(t)
    //draw all tetrahedrons
    gl.bindVertexArray(tgeom.vao)
    drawMoon(t)
    drawPhobos(t)
    drawDeimos(t)
}

function tick(ms) {
    let s = ms / 1000
    draw(s)
    requestAnimationFrame(tick)
}

/**
 * Resizes the canvas to completely fill the screen
 */
function fillScreen() {
    let canvas = document.querySelector('canvas')
    document.body.style.margin = '0'
    canvas.style.width = '100vw'
    canvas.style.height = '100vh'
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    canvas.style.width = ''
    canvas.style = height = ''
    if (window.gl) {
        gl.viewport(0, 0, canvas.width, canvas.height)
        window.projection = m4perspNegZ(0.1, 10, Math.PI / 3 * 2, canvas.width, canvas.height)
    }
    
}
/**
 * Sun:
 * A large octahedron
 * Fixed at the origin (no translation)
 * Spinning a full rotation once every 2 seconds (velocity = 2π / 2 = π) 
 * Since y-axis is pointing up, rotate around y-axis
 */
function drawSun(t) {
    let velocity = Math.PI
    //update projection
    gl.uniformMatrix4fv(program.uniforms.u_ProjectionMatrix, false, window.projection)
    //update spin
    let m = m4rotY(velocity * t)
    gl.uniformMatrix4fv(program.uniforms.u_ModelViewMatrix, false, m4mul(viewMatrix, m))

    gl.drawElements(ogeom.mode, ogeom.count, ogeom.type, 0)
}
/**
 * Earth:
 * A smaller octahedron then 'Sun'
 * Orbiting the Sun once every few seconds
 * Spinning like a top several times a second (velocity = k*2π for some constant k)
 * Since y-axis is pointing up, rotate around y-axis
 */
function drawEarth(t) {
    //spin 1.236 round per second
    let spin_velocity = Math.PI * 2 * 1.236
    //orbit once every 5 seconds
    let orbit_velocity = Math.PI * 2 / 5
    //2 units away from the Sun in x-axis
    let d = 2
    //0.5 times big as the size of the Sun (little smaller than the Sun)
    let r = 0.5
    //update projection
    gl.uniformMatrix4fv(program.uniforms.u_ProjectionMatrix, false, window.projection)
    //update spin, scale, translation, and orbit in order
    let m = m4mul(m4rotY(orbit_velocity * t) , m4trans(d,0,0), m4scale(r,r,r), m4rotY(spin_velocity * t))
    gl.uniformMatrix4fv(program.uniforms.u_ModelViewMatrix, false, m4mul(viewMatrix, m))

    gl.drawElements(ogeom.mode, ogeom.count, ogeom.type, 0)
}
/**
 * Mars:
 * A smaller octahedron then 'Earth'
 * 1.6 times as far from the Sun as the Earth
 * orbiting the Sun 1.9 times slower than the Earth
 * spinning like a top 2.2 times slower than the Earth
 */
function drawMars(t) {
    //spin 1.236/2.2 round per second (2.2 times slower than the Earth)
    let spin_velocity = Math.PI * 2 * 1.236 / 2.2
    //orbit once every 5 / 1.9 seconds (1.9 times slower than the Earth)
    let orbit_velocity = Math.PI * 2 / 5 / 1.9
    //2*1.6 units away from the Sun in x-axis (1.6 times as far from the Sun as the Earth)
    let d = 2*1.6
    //0.5*0.69 times big as the size of the Sun (little smaller than the Earth)
    let r = 0.5 * 0.69
    //update projection
    gl.uniformMatrix4fv(program.uniforms.u_ProjectionMatrix, false, window.projection)
    //update spin, scale, translation, and orbit in order
    let m = m4mul(m4rotY(orbit_velocity * t) , m4trans(d,0,0), m4scale(r,r,r), m4rotY(spin_velocity * t))
    gl.uniformMatrix4fv(program.uniforms.u_ModelViewMatrix, false, m4mul(viewMatrix, m))

    gl.drawElements(ogeom.mode, ogeom.count, ogeom.type, 0)

}
/**
 * Moon:
 * A smaller tetrahedron than the 'Earth'
 * Orbiting the Earth faster than the Earth orbits the Sun but slower than the Earth spins
 * always presenting the same side of itself to the Earth
 */
function drawMoon(t) {
    //orbit velocity is in between [Math.PI * 2 / 5, Math.PI * 2 * 1.236]
    //Pick the average
    let orbit_velocity = Math.PI * (1 / 5 + 1.236)
    //Get Earth orbit velocity
    let earth_orbit_velocity = Math.PI * 2 / 5
    //2 units away from the Sun (Earth) in x-axis
    let ds = 2
    //1 units away from the Earth in x-axis
    let de = 1
    //0.39 times big as the size of the Earth (smaller than the Earth)
    let r = 0.5 * 0.25
    //update projection
    gl.uniformMatrix4fv(program.uniforms.u_ProjectionMatrix, false, window.projection)
    //update scale, translation (Moon-Earth), and transform of Earth (except for spin and scale) in order
    let m = m4mul(m4rotY(earth_orbit_velocity * t), m4trans(ds,0,0), m4rotY(orbit_velocity * t), m4trans(de,0,0), m4scale(r,r,r))
    gl.uniformMatrix4fv(program.uniforms.u_ModelViewMatrix, false, m4mul(viewMatrix, m))

    gl.drawElements(tgeom.mode, tgeom.count, tgeom.type, 0)
}
/**
 * Phobos:
 * A smaller tetrahedron than the 'Mars'
 * Orbiting Mars several times faster than Mars spins
 * always presenting the same side of itself to Mars
 */
function drawPhobos(t) {
    //orbit velocity is at least Math.PI * 2 * 1.236 / 2.2 (choose 2 times faster)
    let orbit_velocity = Math.PI * 2 * 1.236 / 2.2 * 2
    //Get Mars orbit velocity
    let mars_orbit_velocity = Math.PI * 2 / 5 / 1.9
    //2*1.6 units away from the Sun (Mars) in x-axis
    let ds = 2*1.6
    //0.5 units away from the Mars in x-axis
    let dm = 0.5
    //0.39 times big as the size of the Mars (smaller than the Mars)
    let r = 0.5 * 0.69 * 0.39
    //update projection
    gl.uniformMatrix4fv(program.uniforms.u_ProjectionMatrix, false, window.projection)
    //update scale, translation (Phobos-Mars), and transform of Mars (except for spin and scale) in order
    let m = m4mul(m4rotY(mars_orbit_velocity * t), m4trans(ds,0,0), m4rotY(orbit_velocity * t), m4trans(dm,0,0), m4scale(r,r,r))
    gl.uniformMatrix4fv(program.uniforms.u_ModelViewMatrix, false, m4mul(viewMatrix, m))

    gl.drawElements(tgeom.mode, tgeom.count, tgeom.type, 0)
}
/**
 * Deimos:
 * A tetrahedron with size half of Phobos
 * twice as far from Mars as Phobos
 * orbiting Mars only a little faster than Mars spins
 * always presenting the same side of itself to Mars
 */
function drawDeimos(t) {
    //orbit velocity is at least Math.PI * 2 * 1.236 / 2.2 (choose 1.326 faster)
    let orbit_velocity = Math.PI * 2 * 1.236 / 2.2 * 2 * 1.326
    //Get Mars orbit velocity
    let mars_orbit_velocity = Math.PI * 2 / 5 / 1.9
    //2*1.6 units away from the Sun (Mars) in x-axis
    let ds = 2*1.6
    //0.5 * 2 units away from the Mars in x-axis (twice as far from Mars as Phobos)
    let dm = 0.5 * 2
    //0.39 / 2 times big as the size of the Mars (smaller than the Mars and half of Phobos)
    let r = 0.5 * 0.69 * 0.39 / 2
    //update projection
    gl.uniformMatrix4fv(program.uniforms.u_ProjectionMatrix, false, window.projection)
    //update scale, translation (Phobos-Mars), and transform of Mars (except for spin and scale) in order
    let m = m4mul(m4rotY(mars_orbit_velocity * t), m4trans(ds,0,0), m4rotY(orbit_velocity * t), m4trans(dm,0,0), m4scale(r,r,r))
    gl.uniformMatrix4fv(program.uniforms.u_ModelViewMatrix, false, m4mul(viewMatrix, m))

    gl.drawElements(tgeom.mode, tgeom.count, tgeom.type, 0)
}

/**
 * Entry of the program
 * When the web page is loaded, start reading and compiling shaders as well as other source files
 */
window.addEventListener('load', async (event) => {
    window.gl = document.querySelector('canvas').getContext('webgl2', {antialias:false, depth:true, preserveDrawingBuffer:true})
    let vs = await fetch('vs.glsl').then(res => res.text())
    let fs = await fetch('fs.glsl').then(res => res.text())
    window.program = compileShader(vs, fs)
    gl.enable(gl.DEPTH_TEST)
    let octadata = await fetch('octahedron.json').then(r => r.json())
    let tetradata = await fetch('tetrahedron.json').then(r => r.json())
    window.ogeom = setupGeomery(octadata)
    window.tgeom = setupGeomery(tetradata)

    // program.u_transMatrix = gl.getUniformLocation(program, 'u_transMatrix')

    window.viewMatrix = m4view([4,2,4],[0,0,0],[0,0,1])

    fillScreen()
    window.addEventListener('resize', fillScreen)
    requestAnimationFrame(tick)
})

