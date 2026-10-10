import { arenaFor, arenaObstacleCells, drawArena, arenaById } from '../arena-maps.mjs';
import { planAI } from './ai.mjs';
import { randomUUID } from 'node:crypto';
import { confirmedFeedback } from '../feedback-cues.mjs';
import { confirmedAudioCues } from '../audio-cues.mjs';
import {
  createUnit,
  initializeCombat,
  resolvePath,
  useAbility,
  createPillar,
  colosoAction,
  markPiplus, onodAction, korganAction, houganAction, moveHouganDoll, endHouganDollPhase,
  endTurn,
} from "../combat-core.mjs";
import {
  ProtocolError,
  validateCommand,
  commandFingerprint,
  stateFingerprint,
} from "./protocol.mjs";
export const EFFECTIVE_SKILLS = {
  arfeli: ["sword", "daggers", "bow", "spear", "shield", "hammer"],
  coloso: ["rock", "stonearmor", "absorb", "quake", "collapse", "magnetism"],
  piplus: [
    "precise",
    "vector",
    "impulse",
    "interference",
    "rupture",
    "fixation",
  ],
  onod: ["thorn", "vines", "sap", "spores", "awakening", "reabsorption"],
  korgan: ["trap_spikes", "trap_mine", "grenade", "shot", "hook", "hunterstep"],
  houngan: ["needle", "transfer", "ritual", "curse", "paintransfer", "dance"],
};
const err = (c, m) => {
  throw new ProtocolError(c, m);
};
export function createMatch({ id, creatorId, slots, createdAt, mapId, random }) {
  if (!id || !creatorId || !Array.isArray(slots) || ![2,4,6].includes(slots.length))
    err("UNSUPPORTED_FORMAT", "Se habilitan 1v1, 2v2 y 3v3");
  const ids = new Set();
  for (const s of slots) {
    if (
      s.id !== `${s.team}${s.slot}` ||
      !/^([AB][1-3])$/.test(s.id) ||
      ids.has(s.id) ||
      !["A", "B"].includes(s.team) ||
      !Number.isInteger(s.slot) ||
      s.slot < 1 ||
      s.slot > 3 ||
      !s.controllerId
    )
      err("INVALID_SLOT", "Slot inválido");
    ids.add(s.id);
  }
  const teamSize=slots.length/2;
  if (!["A","B"].every(team=>slots.filter(s=>s.team===team).length===teamSize&&Array.from({length:teamSize},(_,i)=>`${team}${i+1}`).every(id=>ids.has(id))))
    err("UNSUPPORTED_FORMAT", "Los equipos deben tener igual cantidad de slots consecutivos");
  return {
    id,
    creatorId,
    arena: mapId ? arenaById(mapId) : drawArena(random),
    mode: `${teamSize}v${teamSize}`,
    players: slots.length===6?6:new Set(slots.map(s=>s.controllerId)).size>2?4:2,
    phase: "preparation",
    version: 0,
    turnSerial: 0,
    turnDeadline: null,
    slots: Object.fromEntries(
      slots.map((s) => [
        s.id,
        {
          ...s,
          championId: null,
          skills: [],
          ready: false,
          position: null,
          confirmed: false,
        },
      ]),
    ),
    combat: null,
    result: null,
    createdAt,
    diagnostics: [],
  };
}
function deployPrepared(m,now) {
  m.phase='deployment';m.countdownDeadline=null;m.deploymentDeadline=now+30000;
  for(const bot of Object.values(m.slots).filter(s=>s.controllerKind==='ai')){
    const free=arenaFor(m).deployment[bot.team].find(cell=>!Object.values(m.slots).some(s=>s.position&&`${s.position.x},${s.position.y}`===cell));
    const [x,y]=free.split(',').map(Number);bot.position={x,y};bot.confirmed=true;
  }
}
function startDeployedCombat(m,started,random) {
  const units = Object.values(m.slots).map((s) =>
    createUnit({
      championId: s.championId,
      ...structuredClone(s),
      id: s.id,
      team: s.team,
      slot: s.slot,
      controllerId: s.controllerId,
      position: s.position,
    }),
  );
  const out = initializeCombat({
    units,
    random: random,
    clock: started,
    obstacles: arenaObstacleCells(arenaFor(m)),
  });
  m.combat = out.state;
  m.phase = "combat";
  m.turnSerial = 0;
  m.turnDeadline = started + (m.mode==='3v3'?30000:40000);
  m.deploymentDeadline=null;return out.events;
}
function fillPreparation(m) {
  for(const slot of Object.values(m.slots)){
    const used=new Set(Object.values(m.slots).filter(s=>s.id!==slot.id&&s.team===slot.team).map(s=>s.championId));
    if(!EFFECTIVE_SKILLS[slot.championId]||used.has(slot.championId))slot.championId=Object.keys(EFFECTIVE_SKILLS).find(id=>!used.has(id));
    const valid=EFFECTIVE_SKILLS[slot.championId];
    slot.skills=[...new Set((slot.skills??[]).filter(id=>valid.includes(id)))];
    for(const id of valid)if(slot.skills.length<4&&!slot.skills.includes(id))slot.skills.push(id);
    slot.ready=true;
  }
}
function publicView(m, viewer) {
  const ownSlots = Object.values(m.slots).filter((s) => s.controllerId === viewer);
  const own = new Set(ownSlots.map((s) => s.id));
  const ownTeams = new Set(ownSlots.map((s) => s.team));
  const view = structuredClone(m);
  if(m.mode==='3v3'&&m.phase==='preparation'&&!m.countdownDeadline)for(const s of Object.values(view.slots))if(!ownTeams.has(s.team)){s.championId=null;s.skills=[];}
  if(view.combat?.traps)view.combat.traps=view.combat.traps.filter((trap)=>ownTeams.has(trap.team));
  return {
    ...view,
    slots: Object.fromEntries(
      Object.entries(view.slots).map(([id, s]) => [
        id,
        m.phase === "deployment" && !own.has(id) && !(s.controllerKind==='ai'&&ownTeams.has(s.team))
          ? {
              ...structuredClone(s),
              id: s.id,
              team: s.team,
              slot: s.slot,
              controllerId: null,
              championId: s.championId,
              skills: s.skills,
              ready: s.ready,
              position: null,
              confirmed: s.confirmed,
            }
          : structuredClone(s),
      ]),
    ),
    diagnostics: undefined,
  };
}
export class AuthoritativeService {
  constructor(
    repository,
    { clock = () => Date.now(), random = () => Math.random() } = {},
  ) {
    this.repo = repository;
    this.clock = clock;
    this.random = random;
  }
  async command(identity, input) {
    validateCommand(input);
    const fingerprint = commandFingerprint(input);
    return this.repo.atomic(
      input.matchId,
      input.id,
      fingerprint,
      identity,
      async (transaction) => {
        const m = await transaction.get();
        if (!m) err("MATCH_NOT_FOUND", "Partida inexistente");
        if (m.version !== input.expectedVersion)
          err("VERSION_CONFLICT", "Versión obsoleta");
        const started = this.clock();
        let events = [];
        const beforeCombat=structuredClone(m.combat);
        const slot = input.slotId ? m.slots[input.slotId] : null;
        if (slot && slot.controllerId !== identity)
          err("FORBIDDEN", "El slot pertenece a otro controlador");
        if (input.type === "preparationTick") {
          if(!Object.values(m.slots).some(s=>s.controllerId===identity))err('FORBIDDEN','No pertenece a la partida');
          if(m.phase!=='preparation'||!m.preparationFlow)err('WRONG_PHASE','Preparación no disponible');
          if(!Object.values(m.slots).every(s=>s.controllerId))err('NOT_CONFIRMED','Faltan jugadores');
          if(!m.preparationDeadline)m.preparationDeadline=started+90000;
          if(!m.countdownDeadline&&started>=m.preparationDeadline)fillPreparation(m);
          if(Object.values(m.slots).every(s=>s.ready)&&!m.countdownDeadline)m.countdownDeadline=started+5000;
          if(m.countdownDeadline&&started>=m.countdownDeadline)deployPrepared(m,started);
        } else if (input.type === "deploymentTick") {
          if(!Object.values(m.slots).some(s=>s.controllerId===identity))err('FORBIDDEN','No pertenece a la partida');
          if(m.phase!=='deployment')err('WRONG_PHASE','Despliegue no disponible');
          if(!m.deploymentDeadline)m.deploymentDeadline=started+30000;
          else if(started>=m.deploymentDeadline){
            const occupied=new Set();
            const ordered=Object.values(m.slots).sort((a,b)=>Number(b.confirmed)-Number(a.confirmed));
            // Keep chosen valid cells, then allocate unset/conflicting slots without stealing their choices.
            for(const slot of ordered){const k=slot.position&&`${slot.position.x},${slot.position.y}`;
              if(k&&arenaFor(m).deployment[slot.team].includes(k)&&!occupied.has(k)){occupied.add(k);slot.confirmed=true;}
              else{slot.position=null;slot.confirmed=false;}
            }
            for(const slot of ordered.filter(s=>!s.position)){
              const free=arenaFor(m).deployment[slot.team].find(cell=>!occupied.has(cell));
              if(!free)err('INVALID_POSITION','Sin casillas disponibles');
              const [x,y]=free.split(',').map(Number);slot.position={x,y};slot.confirmed=true;occupied.add(free);
            }
            events=startDeployedCombat(m,started,this.random);
          }
        } else if (input.type === "aiStep") {
          if(!Object.values(m.slots).some(s=>s.controllerId===identity))err('FORBIDDEN','No pertenece a la partida');
          if(m.phase!=='combat'||input.expectedTurn!==m.turnSerial)err('TURN_CONFLICT','Turno cambiado');
          if(started>=m.turnDeadline)err('TURN_EXPIRED','El turno venció');
          const bot=m.slots[m.combat.order[m.combat.turnIndex]];
          if(bot.controllerKind!=='ai')err('FORBIDDEN','El turno pertenece a un jugador');
          const planned=planAI(m.combat,bot);
          m.combat=planned.out.state;events=planned.out.events;
          if(['endTurn','houganDollEnd'].includes(planned.action.type)){m.turnSerial++;m.turnDeadline=started+(m.mode==='3v3'?30000:40000);}
          if(m.combat.phase==='ended'){m.phase='finished';m.result={winnerTeam:m.combat.winnerTeam,finishedAt:started};m.turnDeadline=null;}
        } else if (input.type === "abandon") {
          if (identity === "backend") err("FORBIDDEN", "Backend no abandona partidas");
          if (m.phase === "finished") err("MATCH_FINISHED", "La partida ya terminó");
          const ownedSlots=Object.values(m.slots).filter(s=>s.controllerId===identity);
          if(!ownedSlots.length)err("FORBIDDEN","No pertenece a la partida");
          const forfeitingTeams=new Set(ownedSlots.map(s=>s.team));
          const otherSlots=Object.values(m.slots).filter(s=>!forfeitingTeams.has(s.team));
          const remainingTeams=[...new Set(otherSlots.map(s=>s.team))];
          const winnerTeam=m.phase==="combat"&&remainingTeams.length===1?remainingTeams[0]:null;
          m.phase="finished";
          m.turnDeadline=null;
          m.result={winnerTeam,finishedAt:started,reason:"abandonment",abandonedBy:ownedSlots.map(s=>s.id)};
          if(m.combat){
            m.combat.phase="ended";
            m.combat.winnerTeam=winnerTeam;
            m.combat.dollPhase=null;
          }
          events.push({type:"match.abandoned",slotIds:ownedSlots.map(s=>s.id),winnerTeam});
        } else if (["move", "endTurn", "ability", "createPillar", "colosoAction", "piplusMark", "onodAction", "korganAction", "houganAction", "houganDollMove", "houganDollEnd"].includes(input.type)) {
          if (m.phase !== "combat") err("WRONG_PHASE", "No está en combate");
          if (input.expectedTurn !== m.turnSerial)
            err("TURN_CONFLICT", "Turno obsoleto");
          if (started >= m.turnDeadline) err("TURN_EXPIRED", "El turno venció");
          const active = m.combat.order[m.combat.turnIndex];
          if (!slot || slot.id !== active || slot.controllerId !== identity)
            err("FORBIDDEN", "Sólo controla el slot activo");
          if (input.type === "ability" && !slot.skills.includes(input.abilityId)) err("ABILITY_NOT_SELECTED", "La habilidad no está en tu selección");
          const wasDollPhase=Boolean(m.combat.dollPhase);
          const out =
            input.type === "houganDollMove"
              ? moveHouganDoll(m.combat,{unitId:slot.id,path:input.path})
              : input.type === "houganDollEnd"
              ? endHouganDollPhase(m.combat,{unitId:slot.id})
              : input.type === "houganAction"
              ? houganAction(m.combat,{unitId:slot.id,action:input.action,position:input.position})
              : input.type === "korganAction"
              ? korganAction(m.combat,{unitId:slot.id,action:input.action,targetId:input.targetId})
              : input.type === "onodAction"
              ? onodAction(m.combat,{unitId:slot.id,action:input.action,targetId:input.targetId,position:input.position})
              : input.type === "piplusMark"
              ? markPiplus(m.combat,{unitId:slot.id,targetId:input.targetId})
              : input.type === "colosoAction"
              ? colosoAction(m.combat,{unitId:slot.id,action:input.action,targetId:input.targetId})
              : input.type === "createPillar"
              ? createPillar(m.combat,{unitId:slot.id,position:input.position})
              : input.type === "ability"
              ? useAbility(m.combat, {unitId:slot.id,abilityId:input.abilityId,targetId:input.targetId,direction:input.direction,secondaryTargetId:input.secondaryTargetId,position:input.position,distance:input.distance})
              : input.type === "move"
              ? resolvePath(m.combat, slot.id, input.path)
              : endTurn(m.combat, { unitId: slot.id });
          m.combat = out.state;
          events = out.events;
          const dollPhaseFinished=input.type==="houganDollEnd"||(input.type==="houganDollMove"&&wasDollPhase&&!m.combat.dollPhase);
          if (input.type === "endTurn" || dollPhaseFinished) {
            m.turnSerial++;
            m.turnDeadline = started + (m.mode==='3v3'?30000:40000);
          }
          if (m.combat.phase === "ended") {
            m.phase = "finished";
            m.result = { winnerTeam: m.combat.winnerTeam, finishedAt: started };
            m.turnDeadline = null;
          }
        } else if (input.type === "select") {
          if (m.phase !== "preparation" || !slot)
            err("WRONG_PHASE", "Selección no disponible");
          if(m.preparationFlow&&m.preparationDeadline&&started>=m.preparationDeadline)err('SELECTION_EXPIRED','La selección terminó');
          m.countdownDeadline=null;
          const valid = EFFECTIVE_SKILLS[input.championId];
          if (
            !valid ||
            !Array.isArray(input.skills) ||
            input.skills.length !== 4 ||
            new Set(input.skills).size !== 4 ||
            input.skills.some((x) => !valid.includes(x))
          )
            err("INVALID_SELECTION", "Campeón o habilidades inválidos");
          if(Object.values(m.slots).some(s=>s.id!==slot.id&&s.team===slot.team&&s.championId===input.championId))
            err("DUPLICATE_CHAMPION", "Tu compañero ya eligió ese campeón");
          Object.assign(slot, {
            championId: input.championId,
            skills: [...input.skills],
            ready: false,
          });
        } else if (input.type === "setReady") {
          if (m.phase !== "preparation" || !slot || !slot.championId)
            err("WRONG_PHASE", "Listo no disponible");
          if (typeof input.ready !== "boolean") err("INVALID_COMMAND", "ready debe ser booleano");
          slot.ready = input.ready;
          if(m.preparationFlow){
            if(!input.ready&&m.preparationDeadline&&started>=m.preparationDeadline)err('SELECTION_EXPIRED','La selección terminó');
            m.countdownDeadline=Object.values(m.slots).every(s=>s.ready)?started+5000:null;
          } else if(Object.values(m.slots).every(s=>s.ready))deployPrepared(m,started);
        } else if (input.type === "setPosition") {
          if(m.deploymentDeadline&&started>=m.deploymentDeadline)err("DEPLOYMENT_EXPIRED","El despliegue terminó");
          if (m.phase !== "deployment" || !slot)
            err("WRONG_PHASE", "Despliegue no disponible");
          if (
            !input.position ||
            !Number.isInteger(input.position.x) ||
            !Number.isInteger(input.position.y) ||
            input.position.x < 0 ||
            input.position.y < 0 ||
            input.position.x >= 12 ||
            input.position.y >= 12 ||
            !arenaFor(m).deployment[slot.team].includes(`${input.position.x},${input.position.y}`)
          )
            err("INVALID_POSITION", "Posición fuera de la zona efectiva");
          slot.position = { ...input.position };
          slot.confirmed = false;
        } else if (input.type === "confirmPosition") {
          if(m.deploymentDeadline&&started>=m.deploymentDeadline)err("DEPLOYMENT_EXPIRED","El despliegue terminó");
          if (m.phase !== "deployment" || !slot?.position)
            err("WRONG_PHASE", "Confirmación no disponible");
          if (
            Object.values(m.slots).some(
              (s) =>
                s.id !== slot.id &&
                s.position &&
                s.position.x === slot.position.x &&
                s.position.y === slot.position.y,
            )
          )
            err("INVALID_POSITION", "Posición ocupada");
          slot.confirmed = true;
        } else if (input.type === "startCombat") {
          if (m.phase !== "deployment")
            err("WRONG_PHASE", "Inicio no disponible");
          if (identity !== m.creatorId)
            err("FORBIDDEN", "Sólo el creador solicita el inicio");
          if (!Object.values(m.slots).every((s) => s.confirmed))
            err("NOT_CONFIRMED", "Faltan confirmaciones");
          events=startDeployedCombat(m,started,this.random);
        } else if (input.type === "expireTurn") {
          if (identity !== "backend") err("FORBIDDEN", "Sólo backend");
          if (
            m.phase !== "combat" ||
            input.expectedTurn !== m.turnSerial ||
            started < m.turnDeadline
          )
            err("NOT_EXPIRED", "Turno no vencido");
          const scheduled = m.turnDeadline;
          const out = m.combat.dollPhase
            ? endHouganDollPhase(m.combat,{unitId:m.combat.dollPhase.ownerId})
            : endTurn(m.combat,{unitId:m.combat.order[m.combat.turnIndex]});
          m.combat = out.state;
          m.turnSerial++;
          m.turnDeadline = started + (m.mode==='3v3'?30000:40000);
          if (m.combat.phase === "ended") {
            m.phase = "finished";
            m.result = { winnerTeam: m.combat.winnerTeam, finishedAt: started };
            m.turnDeadline = null;
          }
          events = [
            ...out.events,
            { type: "turn.expiry_delay", milliseconds: started - scheduled },
          ];
        } else err("UNSUPPORTED_COMMAND", "Comando no soportado");
        m.version++;
        // Accepted, bounded visual history is visible to both current members.
        // It contains no hidden deployment data and is never used for authority.
        const moves = events.filter(event => event.type === "unit.moved" || event.type === "object.moved");
        if (moves.length) {
          const presentation = m.presentation ?? { moves: [], facings: {} };
          for (const event of moves) {
            const path = structuredClone(event.path), isObject=event.type==="object.moved", entityId=isObject?event.objectId:event.unitId;
            presentation.moves.push({ version: m.version, ...(isObject?{objectId:event.objectId}:{unitId:event.unitId}), path, ...(event.kind?{kind:event.kind}:{}) });
            const a = path.at(-2), b = path.at(-1);
            presentation.facings[entityId] = b.x > a.x ? "down-right" : b.x < a.x ? "up-left" : b.y > a.y ? "down-left" : "up-right";
          }
          if (presentation.moves.length > 32) presentation.fromVersion = presentation.moves.at(-33).version;
          presentation.moves = presentation.moves.slice(-32);
          m.presentation = presentation;
        }
        const cues=confirmedAudioCues(events,m.combat);
        if(cues.length){
          m.presentation ??= {moves:[],facings:{}};
          m.presentation.audio ??= [];
          m.presentation.audio.push({version:m.version,serverTime:started,cues});
          m.presentation.audio=m.presentation.audio.slice(-32);
        }
        const feedback=confirmedFeedback(events,beforeCombat,m.combat,input);
        if(feedback.effects.length||feedback.logs.length){
          m.presentation ??= {moves:[],facings:{}};
          m.presentation.feedback ??= [];
          if(feedback.effects.length)m.presentation.feedback.push({version:m.version,serverTime:started,effects:feedback.effects});
          m.presentation.feedback=m.presentation.feedback.slice(-16);
          m.presentation.log=[...(m.presentation.log??[]),...feedback.logs.map(text=>({version:m.version,text}))].slice(-8);
        }
        const diagnostic = {
          commandId: input.id,
          type: input.type,
          accepted: true,
          version: m.version,
          turn: m.turnSerial,
          serverTime: started,
          stateHash: stateFingerprint(m.combat ?? m),
        };
        m.diagnostics.push(diagnostic);
        const result = {
          commandId: input.id,
          version: m.version,
          turn: m.turnSerial,
          state: publicView(m, identity),
          events,
          diagnostic,
          confirmed: true,
        };
        await transaction.save(m, input.expectedVersion);
        return result;
      },
    );
  }
  async advanceAI(identity,id) {
    await this.snapshot(identity,id); // Membership before accessing private state.
    let m=await this.repo.get(id);
    if(m.phase==='preparation'&&m.preparationFlow&&Object.values(m.slots).every(s=>s.controllerId)&&(!m.preparationDeadline||!m.countdownDeadline&&this.clock()>=m.preparationDeadline||m.countdownDeadline&&this.clock()>=m.countdownDeadline)){
      try{await this.command(identity,{id:randomUUID(),matchId:id,type:'preparationTick',expectedVersion:m.version});}
      catch(error){if(!['VERSION_CONFLICT','WRONG_PHASE'].includes(error.code))throw error;}
      m=await this.repo.get(id);
    }
    if(m.phase==='deployment'&&(!m.deploymentDeadline||this.clock()>=m.deploymentDeadline)){
      try{await this.command(identity,{id:randomUUID(),matchId:id,type:'deploymentTick',expectedVersion:m.version});}
      catch(error){if(!['VERSION_CONFLICT','WRONG_PHASE'].includes(error.code))throw error;}
      m=await this.repo.get(id);
    }
    if(m.phase==='combat'&&m.slots[m.combat.order[m.combat.turnIndex]]?.controllerKind==='ai'&&this.clock()<m.turnDeadline){
      try{await this.command(identity,{id:randomUUID(),matchId:id,type:'aiStep',expectedVersion:m.version,expectedTurn:m.turnSerial});}
      catch(error){if(!['VERSION_CONFLICT','TURN_CONFLICT','TURN_EXPIRED'].includes(error.code))throw error;}
    }
    return this.snapshot(identity,id);
  }
  async snapshot(identity, id) {
    const m = await this.repo.get(id);
    if (!m) err("MATCH_NOT_FOUND", "Partida inexistente");
    if (!Object.values(m.slots).some((s) => s.controllerId === identity))
      err("FORBIDDEN", "No pertenece a la partida");
    return publicView(m, identity);
  }
  async recover(identity, matchId, commandId) {
    return this.repo.commandResult(matchId, commandId, identity);
  }
}
export class MemoryRepository {
  constructor(matches = []) {
    this.matches = new Map(matches.map((m) => [m.id, structuredClone(m)]));
    this.commands = new Map();
    this.locks = new Map();
  }
  async get(id) {
    return structuredClone(this.matches.get(id));
  }
  async save(m, version) {
    const old = this.matches.get(m.id);
    if (!old || old.version !== version)
      err("VERSION_CONFLICT", "Confirmación concurrente perdida");
    this.matches.set(m.id, structuredClone(m));
  }
  async atomic(matchId, id, fingerprint, identity, work) {
    const prior = this.locks.get(matchId) || Promise.resolve();
    let release;
    const gate = new Promise((r) => (release = r));
    this.locks.set(
      matchId,
      prior.then(() => gate),
    );
    await prior;
    try {
      const key = `${matchId}:${id}`,
        known = this.commands.get(key);
      if (known) {
        if (known.identity !== identity)
          err("FORBIDDEN", "Resultado privado de otro controlador");
        if (known.fingerprint !== fingerprint)
          err("IDEMPOTENCY_CONFLICT", "ID reutilizado con otro contenido");
        return structuredClone(known.result);
      }
      const result = await work({
        get: async () => structuredClone(this.matches.get(matchId)),
        save: async (match, version) => this.save(match, version),
      });
      this.commands.set(key, {
        fingerprint,
        identity,
        result: structuredClone(result),
      });
      return result;
    } finally {
      release();
    }
  }
  async commandResult(matchId, id, identity) {
    const known = this.commands.get(`${matchId}:${id}`);
    if (!known) return null;
    if (known.identity !== identity)
      err("FORBIDDEN", "Resultado privado de otro controlador");
    return structuredClone(known.result);
  }
}
