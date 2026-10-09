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
   if(args.room.tutorial){
    Object.assign(m.slots.A1,{championId:'arfeli',skills:['sword','bow','shield','hammer'],ready:true,position:{x:4,y:5},confirmed:true});
    Object.assign(m.slots.B1,{position:{x:7,y:5},confirmed:true});
    const units=Object.values(m.slots).map(s=>createUnit({...s,position:s.position}));
    m.arena.pieces=[];m.arena.name='Arena de entrenamiento';
    m.combat=initializeCombat({units,random,clock:clock(),obstacles:[]}).state;m.phase='combat';m.turnDeadline=clock()+40000;m.tutorial=true;
   }
   repo.matches.clear();repo.commands.clear();repo.matches.set(m.id,m);data=await service.snapshot(actor,m.id);
  }else if(operation==='snapshot'){
   let m=await repo.get(args.matchId);if(m?.phase==='combat'&&clock()>=m.turnDeadline)await service.command('backend',{id:crypto.randomUUID(),matchId:m.id,type:'expireTurn',expectedVersion:m.version,expectedTurn:m.turnSerial});
   data=await service.advanceAI(actor,args.matchId);
  }else if(operation==='command')data=await service.command(actor,args.command);
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
