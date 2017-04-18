"use strict";
var Reflection = Reflection || {
  ambient: new Pixel(0, 0, 0),
  diffuse: new Pixel(1.0, 1.0, 1.0),
  specular: new Pixel(1.0, 1.0, 1.0),
  shininess: 20,
};


Reflection.phongReflectionModel = function(vertex, view, normal, lightPos, phongMaterial) {
  var color = new Pixel(0, 0, 0);
  normal.normalize();

  // diffuse
  var light_dir = (new THREE.Vector3()).subVectors(lightPos, vertex).normalize();
  var ndotl = normal.dot(light_dir);
  color.plus(phongMaterial.diffuse.copy().multipliedBy(ndotl));

  // ----------- STUDENT CODE BEGIN ------------
  // if dot product negative, don't add specular
  // getPhongMaterial
  // ----------- Our reference solution uses 9 lines of code.
  // ----------- STUDENT CODE END ------------

  return color;
}

var Renderer = Renderer || {
  meshInstances: new Set(),
  width: 320,
  height: 240,
  negNear: 0.3,
  negFar: 1000,
  fov: 45,
  lightPos: new THREE.Vector3(10, 10, -10),
  shaderMode: "",
  cameraLookAtVector: new THREE.Vector3(0, 0, 0),
  cameraPosition: new THREE.Vector3(0, 0, -10),
  cameraUpVector: new THREE.Vector3(0, -1, 0),
  cameraUpdated: true
};

Renderer.updateCameraParameters = function() {
  this.camera.position.copy(this.cameraPosition);
  this.camera.up.copy(this.cameraUpVector);
  this.camera.lookAt(this.cameraLookAtVector);
};


Renderer.initialize = function() {
  this.buffer = new Image(this.width, this.height);
  this.zBuffer = [];

  // set camera
  this.camera = new THREE.PerspectiveCamera(this.fov, this.width / this.height, this.negNear, this.negFar);
  this.updateCameraParameters();

  this.clearZBuffer();
  this.buffer.display(); // initialize canvas
};

Renderer.clearZBuffer = function() {
  for (var x = 0; x < this.width; x++) {
    this.zBuffer[x] = new Float32Array(this.height);
    for (var y = 0; y < this.height; y++) {
      this.zBuffer[x][y] = 1; // z value is in [-1 1];
    }
  }
};

Renderer.addMeshInstance = function(meshInstance) {
  assert(meshInstance.mesh, "meshInstance must have mesh to be added to renderer");
  this.meshInstances.add(meshInstance);
};

Renderer.removeMeshInstance = function(meshInstance) {
  this.meshInstances.delete(meshInstance);
};

Renderer.clear = function() {
  this.buffer.clear();
  this.clearZBuffer();
  Main.context.clearRect(0, 0, Main.canvas.width, Main.canvas.height);
};

Renderer.displayImage = function() {
  this.buffer.display();
};

Renderer.render = function() {
  this.clear();

  var eps = 0.01;
  if (!(this.cameraUpVector.distanceTo(this.camera.up) < eps &&
      this.cameraPosition.distanceTo(this.camera.position) < eps &&
      this.cameraLookAtVector.distanceTo(Main.controls.target) < eps)) {
    this.cameraUpdated = false;
    // update camera position
    this.cameraLookAtVector.copy(Main.controls.target);
    this.cameraPosition.copy(this.camera.position);
    this.cameraUpVector.copy(this.camera.up);
  } else { // camera's stable, update url once
    if (!this.cameraUpdated) {
      Gui.updateUrl();
      this.cameraUpdated = true; //update one time
    }
  }

  this.camera.updateMatrixWorld();
  this.camera.matrixWorldInverse.getInverse(this.camera.matrixWorld);

  // light goes with the camera, COMMENT this line for debugging if you want
  this.lightPos = this.camera.position;

  for (var meshInst of this.meshInstances) {
    var mesh = meshInst.mesh;
    if (mesh !== undefined) {
      for (var faceIdx = 0; faceIdx < mesh.faces.length; faceIdx++) {
        var face = mesh.faces[faceIdx];
        var verts = [mesh.vertices[face.a], mesh.vertices[face.b], mesh.vertices[face.c]];
        var vert_normals = [mesh.vertex_normals[face.a], mesh.vertex_normals[face.b], mesh.vertex_normals[face.c]];

        // camera's view matrix = K * [R | t] where K is the projection matrix and [R | t] is the inverse of the camera pose
        var viewMat = (new THREE.Matrix4()).multiplyMatrices(this.camera.projectionMatrix,
          this.camera.matrixWorldInverse);


        Renderer.drawTriangle(verts, vert_normals, mesh.uvs[faceIdx], meshInst.material, viewMat);
      }
    }
  }

  this.displayImage();
};

Renderer.getPhongMaterial = function(uv_here, material) {
  var phongMaterial = {};
  phongMaterial.ambient = Reflection.ambient;

  if (material.diffuse === undefined || uv_here === undefined) {
    phongMaterial.diffuse = Reflection.diffuse;
  } else if (Pixel.prototype.isPrototypeOf(material.diffuse)) {
    phongMaterial.diffuse = material.diffuse;
  } else {
    // note that this function uses point sampling. it would be better to use bilinear
    // subsampling and mipmaps for area sampling, but this good enough for now...
    phongMaterial.diffuse = material.diffuse.getPixel(Math.floor(uv_here.x * (material.diffuse.width-1)),
      Math.floor(uv_here.y * (material.diffuse.height-1)));
  }

  if (material.specular === undefined || uv_here === undefined) {
    phongMaterial.specular = Reflection.specular;
  } else if (Pixel.prototype.isPrototypeOf(material.specular)) {
    phongMaterial.specular = material.specular;
  } else {
    phongMaterial.specular = material.specular.getPixel(Math.floor(uv_here.x * (material.specular.width-1)),
      Math.floor(uv_here.y * (material.specular.height-1)));
  }

  phongMaterial.shininess = Reflection.shininess;

  return phongMaterial;
};

Renderer.projectVerticesNaive = function(verts) {
  // this is a naive orthogonal projection, does not even consider camera pose
  var projectedVerts = [];

  var orthogonalScale = 5;
  for (var i = 0; i < 3; i++) {
    projectedVerts[i] = new THREE.Vector4(verts[i].x, verts[i].y, verts[i].z, 1.0);

    projectedVerts[i].x /= orthogonalScale;
    projectedVerts[i].y /= orthogonalScale * this.height / this.width;

    projectedVerts[i].x = projectedVerts[i].x * this.width / 2 + this.width / 2;
    projectedVerts[i].y = projectedVerts[i].y * this.height / 2 + this.height / 2;
  }

  return projectedVerts;
};

Renderer.projectVertices = function(verts, viewMat) {
  var projectedVerts = []; // Vector3/Vector4 array (you need z for z buffering)

  // ----------- STUDENT CODE BEGIN ------------
  // viewMat --> camera's view matrix = K * [R | t] where K is the projection matrix and [R | t] is the inverse of the camera pose
  var i_outOfBounds = 0;

  for (var i = 0; i < verts.length; i++) {
    var orthogonalScale = 5;
    var orthogonalScale = verts[i].z + 5;

    projectedVerts[i] = new THREE.Vector4(verts[i].x, verts[i].y, verts[i].z, 1.0);
    projectedVerts[i] = projectedVerts[i].applyMatrix4(viewMat);

    projectedVerts[i].x /= projectedVerts[i].w;
    projectedVerts[i].y /= projectedVerts[i].w;
    projectedVerts[i].z /= projectedVerts[i].w;

    projectedVerts[i].x = projectedVerts[i].x * this.width / 2 + this.width / 2;
    projectedVerts[i].y = projectedVerts[i].y * this.height / 2 + this.height / 2;

    if ( projectedVerts[i].z >= 0 )
      i_outOfBounds++;
    if ( this.negNear >= projectedVerts[i].z && this.negFar <= projectedVerts[i].z ) {} // do nothing
    else { i_outOfBounds++; }
  }

  // Check if triangle out of bounds --> if out of bounds, do not render triangle
  if ( i_outOfBounds === 3 ) { return undefined; }

  // ----------- Our reference solution uses 12 lines of code.
  // ----------- STUDENT CODE END ------------
  return projectedVerts;
};

Renderer.computeBoundingBox = function(projectedVerts) {
  var box = {};
  box.minX = -1;
  box.minY = -1;
  box.maxX = -1;
  box.maxY = -1;

  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 14 lines of code.
  function checkBounds(vert) {

    var roundedVertX = Math.round(vert.x);
    var roundedVertY = Math.round(vert.y);

    if (roundedVertX < box.minX) {
      box.minX = roundedVertX;
    }
    if (roundedVertY < box.minY) {
      box.minY = roundedVertY;
    }
    if (roundedVertX > box.maxX) {
      box.maxX = roundedVertX;
    }
    if (roundedVertY > box.maxY) {
      box.maxY= roundedVertY;
    }
  }

  projectedVerts.forEach(v => checkBounds(v));
  // ----------- STUDENT CODE END ------------
  return box;
};

function make2D(vert3D) {
  return new THREE.Vector3(vert3D,x, vert3D.y,0);
}
Renderer.computeBarycentric = function(projectedVerts, x, y) {
  var triCoords = [];
  // (see https://fgiesen.wordpress.com/2013/02/06/the-barycentric-conspirac/)
  // return undefined if (x,y) is outside the triangle
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 15 lines of code.

  var triPoints = projectedVerts.map(function(vert) {
    return new THREE.Vector3(vert.x, vert.y, 0);
  })
  var point = new THREE.Vector3(x,y, 0);

  var triangle = new THREE.Triangle(make2D(triPoints[0]), make2D(triPoints[1]), make2D(triPoints[2]));
  if (triangle.containsPoint(point)) {
    return triangle.barycoordFromPoint(point)
  }
  else {
      return undefined;
  }
  // ----------- STUDENT CODE END ------------
  return triCoords;
};

Renderer.drawTriangleWire = function(projectedVerts) {
  //console.log("GSFD")
  var color = new Pixel(1.0, 0, 0);
  for (var i = 0; i < 3; i++) {
    var va = projectedVerts[(i + 1) % 3];
    var vb = projectedVerts[(i + 2) % 3];

    var ba = new THREE.Vector2(vb.x - va.x, vb.y - va.y);
    var len_ab = ba.length();
    ba.normalize();
    // draw line
    for (var j = 0; j < len_ab; j += 0.5) {
      var x = Math.round(va.x + ba.x * j);
      var y = Math.round(va.y + ba.y * j);
      this.buffer.setPixel(x, y, color);
    }
  }
};

Renderer.drawTriangleFlat = function(verts, projectedVerts, normals, uvs, material) {
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 45 lines of code.

  // do z buffer stuff
  function _calculateAverageVect(normals) {
    var avgNorm = new THREE.Vector3(0,0,0);
    normals.forEach(function (norm) {
      avgNorm.add(norm)
    })
    avgNorm.divideScalar(normals.length)
    return avgNorm;
  }
  function _getFlatColor(lightPos) {
    var flatColor = new Pixel(0, 0, 0);
    //console.log(material);
    if (material.ambient === undefined) {
      flatColor.plus(Reflection.ambient)
    }
    else {
      flatColor.plus(material.ambient);
    }
    //console.log(normals)
    var centroidNormal = _calculateAverageVect(normals);
    //console.log(centroidNormal)
    var centroidVertex = _calculateAverageVect(verts);
    var light_dir = (new THREE.Vector3()).subVectors(lightPos, centroidVertex).normalize();
    var ndotl = centroidNormal.dot(light_dir);

    if (material.diffuseComponent === undefined) {
      var diffuseComponent = Reflection.diffuse.copy().multipliedBy(ndotl);
    }
    else {
      var diffuseComponent = material.diffuse.copy().multipliedBy(ndotl);
    }
    flatColor.plus(diffuseComponent);
    return flatColor;
  }

  function _getCentroidDist(projectedVerts) {
    var centroidVertex = _calculateAverageVect(projectedVerts);
    return centroidVertex.z;


  }



  var projectedTriangle = new THREE.Triangle(projectedVerts[0], projectedVerts[1], projectedVerts[2]);
  var faceColor = _getFlatColor(this.lightPos);
  var boundBox = Renderer.computeBoundingBox(projectedVerts);
  var centroidDist = _getCentroidDist(projectedVerts)
  console.log(centroidDist)

  var eps = 0.01;

  for (var x = boundBox.minX; x < boundBox.maxX; x++) {
    for (var y = boundBox.minY; y < boundBox.maxY; y++) {
      var currentHalfPix = new THREE.Vector3(Math.floor(x) + 0.5, Math.floor(y) + 0.5, 0);
      if (projectedTriangle.containsPoint(currentHalfPix)) {
        if (centroidDist > -eps && centroidDist < this.zBuffer[x][y]) {
        this.buffer.setPixel(x,y,faceColor);
        }
        //this.buffer.setPixel(x, y, new Pixel(1,0,0));
      }

       //this.buffer.setPixel(x, y, new Pixel(1,0,0));// for the bounding box

    }
  }
  // ----------- STUDENT CODE END ------------
};

Renderer.drawTriangleGouraud = function(verts, projectedVerts, normals, uvs, material) {
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 42 lines of code.
  // ----------- STUDENT CODE END ------------
};


Renderer.drawTrianglePhong = function(verts, projectedVerts, normals, uvs, material) {
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 53 lines of code.
  // ----------- STUDENT CODE END ------------
};


Renderer.drawTriangle = function(verts, normals, uvs, material, viewMat) {

  var projectedVerts = this.projectVertices(verts, viewMat);
  if (projectedVerts === undefined) { // not within near and far plane
    return;
  } else if (projectedVerts.length <= 0){
    projectedVerts = this.projectVerticesNaive(verts);
  }

  switch (this.shaderMode) {
    case "Wire":
      this.drawTriangleWire(projectedVerts);
      break;
    case "Flat":
      this.drawTriangleFlat(verts, projectedVerts, normals, uvs, material);
      break;
    case "Gouraud":
      this.drawTriangleGouraud(verts, projectedVerts, normals, uvs, material);
      break;
    case "Phong":
      this.drawTrianglePhong(verts, projectedVerts, normals, uvs, material);
      break;
    default:
  }
};
