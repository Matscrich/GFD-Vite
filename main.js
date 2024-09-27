import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';

var world;
var dt = 1 / 60;

var constraintDown = false;
var camera, scene, renderer, gplane=false, clickMarker=false;
var geometry, material, mesh;
var controls,time = Date.now();

var jointBody, constrainedBody, mouseConstraint;

let cubeSizeX= 3;
let cubeSizeY= 0.8;
let cubeSizeZ= 1.8;
// find the location of the suspensions based on the size of the chassis
let suspFRoffset=0;//needs to be a vector
const loader = new GLTFLoader();
// To be synced
var meshes=[], bodies=[];
var heartRawPoints, mapRawPoints, mapIndices;
var globalScale= 0.05;


init();
runRapier();
animate();

function init() {

    //create a div to show the 3d scene and insert it between top and bottom bar
    let gameDiv = document.createElement('div');
    gameDiv.classList.add('game');
    let lastDiv= document.getElementsByClassName("bottomBar")[0]
    document.body.insertBefore(gameDiv, lastDiv)


    // scene b
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog( 0x000000, 500, 10000 );

    // camera
    camera = new THREE.PerspectiveCamera( 35, window.innerWidth / (window.innerHeight*0.77) , 0.5, 10000 );
    camera.position.set(0,0,0);
    camera.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI/2);
    scene.add(camera);

    // lights
    var light, materials;
    scene.add( new THREE.AmbientLight( 0x666666 ) );

    light = new THREE.DirectionalLight( 0xffffff, 12 );
    var d = 70;

    light.position.set( -d, d, 0.6*d );

    light.castShadow = true;
    //shadow projection settings
    light.shadow.mapSize.width = 3000;
    light.shadow.mapSize.height = 3000;
    light.shadow.camera.near = d;
    light.shadow.camera.far = 2*d; 
    light.shadow.camera.left = -d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = -d;

    scene.add( light );

    // floor
    geometry = new THREE.PlaneGeometry( 100, 100, 1, 1 );
    //geometry.applyMatrix( new THREE.Matrix4().makeRotationX( -Math.PI / 2 ) );
    material = new THREE.MeshPhysicalMaterial( { color: 0x777777 } );
    //let markerMaterial = new THREE.MeshLambertMaterial( { color: 0xff0000 } );
    //THREE.ColorUtils.adjustHSV( material.color, 0, 0, 0.9 );
    mesh = new THREE.Mesh( geometry, material );
    mesh.castShadow = false;
    mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI / 2);
    mesh.receiveShadow = true;
    scene.add(mesh);

    // cube
    var cubeGeo = new THREE.BoxGeometry( cubeSizeX, cubeSizeY, cubeSizeZ);
    var cubeMaterial = new THREE.MeshPhysicalMaterial( { color: 0x888888 } );
    let cubeMesh = new THREE.Mesh(cubeGeo, cubeMaterial);
    cubeMesh.castShadow = true;
    cubeMesh.receiveShadow = true;
    meshes.push(cubeMesh);
    scene.add(cubeMesh);

    //heart model
    loader.load( '../assets/heart.glb', function ( gltf ) {

        let heartGeo= gltf.scene.children[0]
        heartRawPoints = new Float32Array(gltf.scene.children[0].geometry.getAttribute('position').array)
        console.log("heartrawpoints check1", heartRawPoints)
        //console.log('heartmodel'); console.log(gltf.scene.children[0])
        let heartScale= 0.5
        //heartGeo.scale.set( heartScale, heartScale, heartScale );
        heartGeo.material= cubeMaterial
        heartGeo.castShadow = true;
        heartGeo.receiveShadow = true;
        meshes.push(heartGeo)
        scene.add(heartGeo)

    }, undefined, function ( error ) {

        console.error( error );

    } );
    console.log("heartrawpoints check2", heartRawPoints)

    //map model 
    loader.load( '../assets/maptest.glb', function ( gltf ) {

        let mapGeo= gltf.scene.children[0]
        console.log("map model", mapGeo)
        mapRawPoints = mapGeo.geometry.attributes.position.array
        console.log("map rawpoints", mapRawPoints)
        mapIndices = new Uint32Array(mapGeo.geometry.getIndex().array)
        console.log("map indices", mapIndices)
        mapGeo.castShadow = true;
        mapGeo.receiveShadow = true;
        //mapGeo.material= new THREE.MeshStandardMaterial()
        scene.add( mapGeo );

        }, undefined, function ( error ) {
    
            console.log( error );
    
        }
    ); 

    /* //test with ramps level from doppler KCC demo
    loader.load( '../assets/ramps.glb', function ( gltf ) {

        let mapGeo= gltf.scene.children[0]
        console.log("map model", mapGeo)
        mapRawPoints = new Float32Array(mapGeo.geometry.attributes.position.array)
        console.log("map rawpoints", mapRawPoints)
        mapIndices = new Uint32Array(mapGeo.geometry.getIndex().array)
        console.log("map indices", mapIndices)
        mapGeo.castShadow = true;
        mapGeo.receiveShadow = true;
        mapGeo.material= new THREE.MeshStandardMaterial()
        scene.add( mapGeo );

        }, undefined, function ( error ) {
    
            console.log( error );
    
        } 
    ); */

    //skybox model
    loader.load( '../assets/skybox.glb', function ( gltf ) {

        let skyboxGeo= gltf.scene.children[0]
        //console.log('skybox object', skyboxGeo)
        let newMat= new THREE.MeshBasicMaterial()
        newMat.map= skyboxGeo.material.map
        skyboxGeo.material= newMat
        skyboxGeo.scale.set(globalScale, globalScale, globalScale)
        scene.add( skyboxGeo );

        }, undefined, function ( error ) {
    
            console.log( error );
    
        }
    );


    //rendering stuff
    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setSize( window.innerWidth, window.innerHeight*0.77 );
    renderer.setClearColor( scene.fog.color );
    renderer.shadowMap.enabled = true;

    gameDiv.appendChild( renderer.domElement );

    renderer.gammaInput = true;
    renderer.gammaOutput = true;
    //renderer.shadowMapEnabled = true;

    window.addEventListener( 'resize', onWindowResize, false );
    
    // orbit controls
    controls = new OrbitControls( camera, renderer.domElement );
    //controls.addEventListener( 'change', render ); // call this only in static scenes (i.e., if there is no animation loop)
    controls.screenSpacePanning = true;
    //controls.minDistance = 10;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.copy( new THREE.Vector3(425, -40, -120))
    

}

function onWindowResize() {
    camera.aspect = window.innerWidth / (window.innerHeight*0.77) ;
    camera.updateProjectionMatrix();
    //controls.handleResize();
    renderer.setSize( window.innerWidth, window.innerHeight*0.77 );
}

function animate() {
    requestAnimationFrame( animate );
    render();
    //updates the target of the camera
    controls.update()
}


function render() {
    renderer.render(scene, camera);
}

function runRapier() {
  import('@dimforge/rapier3d').then(RAPIER => {
        //initialize the physics simulation

        let world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
        world.timestep = dt
        //console.log("world timestep", world.timestep)
        //create the ground physics
        let groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
        var groundBody = world.createRigidBody(groundBodyDesc)
        let groundColDesc = RAPIER.ColliderDesc.cuboid(50, 0, 50)
        let groundCol = world.createCollider(groundColDesc, groundBody)

        // Create the Cube physics
        let CubeBodyDesc = RAPIER.RigidBodyDesc.dynamic();
        var CubeBody = world.createRigidBody(CubeBodyDesc)
        CubeBody.setTranslation(new RAPIER.Vector3(425, -45, -120))
        let CubeColDesc = RAPIER.ColliderDesc.cuboid(cubeSizeX*0.5,cubeSizeY*0.5,cubeSizeZ*0.5);
        let CubeCol = world.createCollider(CubeColDesc, CubeBody)
        bodies.push(CubeBody);

        //create the heart physics
        let heartBodyDesc = RAPIER.RigidBodyDesc.dynamic();
        var heartBody = world.createRigidBody(heartBodyDesc)
        console.log("heartrawpoints check3", heartRawPoints)
        let heartColDesc = RAPIER.ColliderDesc.convexHull(heartRawPoints);
        let heartCol = world.createCollider(heartColDesc, heartBody)
        heartBody.setTranslation(new RAPIER.Vector3(425, -40, -120))

        bodies.push(heartBody)
        console.log("bodies"); console.log(bodies)
        console.log("meshes"); console.log(meshes)

        //create map physics
        let mapBodyDesc = RAPIER.RigidBodyDesc.fixed()
        var mapBody = world.createRigidBody(mapBodyDesc)
        let mapColDesc = RAPIER.ColliderDesc.trimesh(mapRawPoints, mapIndices, 'FIX_INTERNAL_EDGES');
        let mapCol = world.createCollider(mapColDesc, mapBody)

        //animate the models
        let gameLoop = () => {
            world.step();

            // Get and print the rigid-body's position.
            //console.log("Cube Body position: ", CubeBody.translation());
            //console.log("Cube Body rotation: ", CubeBody.rotation());
            //console.log("heart Body position: ", heartBody.translation());
            
            //updates the target of the camera
            controls.target.copy(heartBody.translation())
            //console.log("orbit controls target", controls.target)

            //updates display of threejs meshes
            for(var i=0; i !== meshes.length; i++){
                meshes[i].position.copy(bodies[i].translation());
                meshes[i].quaternion.copy(bodies[i].rotation());
            }
            setTimeout(gameLoop);
        };
  
    gameLoop();
  });
}