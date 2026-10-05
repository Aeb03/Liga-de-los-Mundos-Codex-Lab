import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUD_STORAGE_KEY, normalizeHudSettings, loadHudSettings, saveHudSetting, resetHudSettings,
  rotateCell, rotateFacing, clampCamera, cameraParallax, clampZoom, cameraForPinch, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM
} from './hud-camera.mjs';

function fakeStorage(){
  const map=new Map();
  return {
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key)
  };
}

test('HUD copia defaults offline y fuerza Ronda/Comando horizontales',()=>{
  const hud=normalizeHudSettings({
    player:{orientation:'horizontal',collapsed:true},
    round:{orientation:'vertical'},
    command:{orientation:'vertical'}
  });
  assert.equal(hud.player.orientation,'horizontal');
  assert.equal(hud.player.collapsed,true);
  assert.equal(hud.enemy.orientation,'vertical');
  assert.equal(hud.round.orientation,'horizontal');
  assert.equal(hud.command.orientation,'horizontal');
});

test('HUD persiste posición normalizada, plegado y orientación sin contaminar valores inválidos',()=>{
  const storage=fakeStorage();
  let hud=saveHudSetting(storage,'player',{x:1.5,y:-.2,collapsed:true,orientation:'horizontal'});
  assert.deepEqual({x:hud.player.x,y:hud.player.y,collapsed:hud.player.collapsed,orientation:hud.player.orientation},{x:1,y:0,collapsed:true,orientation:'horizontal'});
  hud=saveHudSetting(storage,'round',{orientation:'vertical',x:.4,y:.6});
  assert.equal(hud.round.orientation,'horizontal');
  assert.equal(JSON.parse(storage.getItem(HUD_STORAGE_KEY)).round.orientation,'horizontal');
  assert.equal(loadHudSettings(storage).round.x,.4);
  assert.equal(resetHudSettings(storage).player.orientation,'vertical');
  assert.equal(storage.getItem(HUD_STORAGE_KEY),null);
});

test('rotación de cámara conserva coordenadas lógicas y transforma sólo la vista',()=>{
  assert.deepEqual(rotateCell(2,5,0),{x:2,y:5});
  assert.deepEqual(rotateCell(2,5,1),{x:6,y:2});
  assert.deepEqual(rotateCell(2,5,2),{x:9,y:6});
  assert.deepEqual(rotateCell(2,5,3),{x:5,y:9});
  assert.deepEqual(rotateCell(2,5,4),{x:2,y:5});
});

test('facings tácticos giran junto con la cámara',()=>{
  assert.equal(rotateFacing('down-right',1),'down-left');
  assert.equal(rotateFacing('down-left',1),'up-left');
  assert.equal(rotateFacing('up-left',1),'up-right');
  assert.equal(rotateFacing('up-right',1),'down-right');
  assert.equal(rotateFacing('down-right',2),'up-left');
});

test('clamp y parallax usan los límites extraídos del offline',()=>{
  const camera=clampCamera({x:999,y:-999,rotation:5},400,200);
  assert.deepEqual(camera,{x:184,y:-92,rotation:1,zoom:1});
  assert.deepEqual(cameraParallax({x:100,y:50}),{x:22,y:7.000000000000001});
  assert.deepEqual(cameraParallax({x:999,y:-999}),{x:56,y:-20});
});


test('zoom táctil queda limitado a un rango razonable',()=>{
  assert.equal(clampZoom(.1),CAMERA_MIN_ZOOM);
  assert.equal(clampZoom(99),CAMERA_MAX_ZOOM);
  assert.equal(clampZoom(1.25),1.25);
  assert.deepEqual(clampCamera({x:999,y:-999,rotation:0,zoom:1.6},400,200),{x:294.40000000000003,y:-147.20000000000002,rotation:0,zoom:1.6});
});

test('pinch mantiene estable el punto bajo los dedos y permite acercar o alejar',()=>{
  const base={x:10,y:-5,rotation:0,zoom:1};
  const stageCenter={x:200,y:100};
  const zoomIn=cameraForPinch(base,{x:220,y:110},{x:220,y:110},100,150,stageCenter,400,200);
  assert.equal(zoomIn.zoom,1.5);
  assert.equal(zoomIn.x,5);
  assert.equal(zoomIn.y,-12.5);
  const zoomOut=cameraForPinch(base,{x:220,y:110},{x:230,y:120},100,50,stageCenter,400,200);
  assert.equal(zoomOut.zoom,.9);
  assert.ok(Number.isFinite(zoomOut.x)&&Number.isFinite(zoomOut.y));
});
