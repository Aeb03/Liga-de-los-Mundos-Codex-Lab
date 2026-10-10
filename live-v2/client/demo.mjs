import {AuthoritativeService,MemoryRepository,createMatch} from './demo/authority.mjs';
import {createUnit,initializeCombat} from '../combat-core.mjs?v=20261009-sapmine1';
const botSkills={arfeli:['sword','daggers','bow','shield'],coloso:['rock','stonearmor','absorb','quake'],piplus:['precise','vector','interference','rupture'],onod:['thorn','vines','sap','reabsorption'],korgan:['shot','grenade','hook','hunterstep'],houngan:['needle','ritual','curse','dance']};
export function createDemoAPI({actor='demo-player',clock=()=>Date.now(),random=Math.random}={}){
 const repo=new MemoryRepository(),service=new AuthoritativeService(repo,{clock,random});
 return async (operation,args)=>{let data;try{
  if(operation==='create'){
   const bot=args.room.layout?.B1?.championId??'coloso';if(!botSkills[bot])throw new Error('INVALID_SELECTION');
   const m=createMatch({id:args.room.id,creatorId:actor,createdAt:clock(),random,slots:[{id:'A1',team:'A',slot:1,controllerId:actor,controllerKind:'human'},{id:'B1',team:'B',slot:1,controllerId:'demo-bot',controllerKind:'ai'}]});
   Object.assign(m.slots.B1,{championId:bot,skills:botSkills[bot],ready:true});m.preparationFlow=true;m.preparationDeadline=clock()+90000;
   if(args.room.tutorial){m.tutorial=true;m.tutorialClock=false;}
   repo.matches.clear();repo.commands.clear();repo.matches.set(m.id,m);data=await service.snapshot(actor,m.id);
  }else if(operation==='tutorialScene'){
   const m=await repo.get(args.matchId);if(!m?.tutorial||m.creatorId!==actor||m.phase!=='combat')throw new Error('DEMO_ONLY');
   const units=Object.values(m.slots).map(s=>createUnit({...s,position:s.id==='A1'?{x:5,y:5}:args.scene==='area'?{x:5,y:7}:{x:7,y:5}}));
   m.combat=initializeCombat({units,random,clock:clock(),obstacles:args.scene==='vision'?[{x:6,y:5}]:[]}).state;
   m.combat.order=['A1','B1'];m.combat.turnIndex=0;m.combat.units.find(u=>u.id==='A1').colosoTurnSerial=1;
   m.arena.pieces=args.scene==='vision'?[{id:'training-wall',type:'pillar',cells:[{x:6,y:5}]}]:[];
   m.arena.name='Arena de entrenamiento';m.turnSerial+=1;m.version+=1;m.turnDeadline=clock()+40000;
   if(args.scene==='area'){m.combat.nextPillarId=2;m.combat.objects.push({id:'pillar1',number:1,kind:'object',type:'pillar',ownerId:'A1',team:'A',x:5,y:6,hp:15,maxHp:15,alive:true,shield:[],blocksLOS:true,createdByColosoTurn:0});}
   if(args.scene==='states')Object.assign(m.combat.units.find(u=>u.id==='A1').status,{wound:2,poison:1,burn:2});
   m.tutorialClock=args.scene==='clock';if(m.tutorialClock)m.turnDeadline=clock()+10000;
   await repo.save(m,m.version-1);data=await service.snapshot(actor,m.id);
  }else if(operation==='snapshot'){
   let m=await repo.get(args.matchId);
   if(m?.tutorial&&!m.tutorialClock){if(m.phase==='combat')m.turnDeadline=clock()+40000;if(m.phase==='preparation')m.preparationDeadline=clock()+90000;if(m.phase==='deployment')m.deploymentDeadline=clock()+30000;await repo.save(m,m.version);}
   if(m?.phase==='combat'&&clock()>=m.turnDeadline)await service.command('backend',{id:crypto.randomUUID(),matchId:m.id,type:'expireTurn',expectedVersion:m.version,expectedTurn:m.turnSerial});
   data=m?.tutorial&&m.phase==='combat'&&!m.tutorialClock?await service.snapshot(actor,args.matchId):await service.advanceAI(actor,args.matchId);
  }else if(operation==='command'){
   const m=await repo.get(args.command.matchId);if(m?.tutorial&&!m.tutorialClock){if(m.phase==='combat')m.turnDeadline=clock()+40000;if(m.phase==='preparation')m.preparationDeadline=clock()+90000;if(m.phase==='deployment')m.deploymentDeadline=clock()+30000;await repo.save(m,m.version);}
   data=await service.command(actor,args.command);
  }
  else if(operation==='recover')data=await service.recover(actor,args.matchId,args.commandId);
  else throw new Error('DEMO_ONLY');
  return {data,serverTime:clock()};
 }catch(error){error.definitive=true;throw error;}};
}
export function tutorialHint(combat){
 const own=combat?.units.find(u=>u.id==='A1');if(!own)return 'Tocá una casilla para elegir dónde moverte.';
 if(combat.phase==='ended')return 'Tutorial completado. Volvé a la demo para probar otros campeones.';
 if(combat.order[combat.turnIndex]!=='A1')return 'La IA juega su turno. Observá cómo se renuevan los PA y PM.';
 if(own.x===4&&own.y===5)return '1 · Tocá Mover, elegí una casilla cercana al rival y tocala otra vez para confirmar.';
 if(own.pa===6)return '2 · Elegí una habilidad, tocá al rival y volvé a tocarlo para ejecutarla. Escudo se usa sobre vos.';
 return '3 · Podés seguir actuando con tus PA y PM. Cuando termines, tocá Fin de turno.';
}
