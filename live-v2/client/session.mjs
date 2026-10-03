import { SyncCoordinator } from '../sync/coordinator.mjs';

export class LiveSession {
  constructor({ api, storage, onChange = () => {}, onError = () => {}, clock = () => Date.now() }) {
    this.api=api; this.storage=storage; this.onChange=onChange; this.onError=onError; this.clock=clock;
    this.state=null; this.actor=null; this.preview=null; this.online=true; this.refreshing=false;
    this.busy=false; this.offset=0;
    this.sync=new SyncCoordinator({applySnapshot: state=>{
      this.state=state; this.preview=null; this.storage?.setItem('live-v2-lab-match',state.id);
      this.onChange();
    }});
  }
  async attach(actor, state) {
    this.actor=actor;
    this.sync.applyEnvelope({version:state.version,state});
    const saved=this.storage?.getItem(`live-v2-lab-pending:${actor}:${state.id}`);
    if(saved){try{this.sync.beginCommand(JSON.parse(saved));}catch{this.storage.removeItem(`live-v2-lab-pending:${actor}:${state.id}`);}}
    this.onChange();
    await this.refresh();
  }
  now(){return this.clock()+this.offset;}
  remaining(){return this.state?.turnDeadline == null ? null : Math.max(0,Math.ceil((this.state.turnDeadline-this.now())/1000));}
  canAct(){return this.online&&!this.busy&&!this.sync.pendingCommand()&&this.state?.phase==='combat'&&this.remaining()>0;}
  persistPending(){
    if(!this.actor||!this.state)return;
    const key=`live-v2-lab-pending:${this.actor}:${this.state.id}`;
    const pending=this.sync.pendingCommand();
    if(pending)this.storage?.setItem(key,JSON.stringify(pending.command));else this.storage?.removeItem(key);
  }
  disconnect(){this.online=false;this.preview=null;this.sync.disconnect();this.onChange();}
  async request(operation,args){
    const started=this.clock(); const reply=await this.api(operation,args);
    if(reply.serverTime!=null)this.offset=reply.serverTime-(started+this.clock())/2;
    return reply.data;
  }
  async send(type, extra={}) {
    if(this.busy||this.sync.pendingCommand()||!this.online)throw new Error('COMMAND_PENDING');
    const command={id:crypto.randomUUID(),matchId:this.state.id,type,expectedVersion:this.state.version,...extra};
    this.sync.beginCommand(command);this.persistPending();this.preview=null;this.onChange();
    return await this.dispatch(command);
  }
  async dispatch(command){
    this.busy=true; this.onChange();
    try{
      const reply=await this.request('command',{command});
      this.online=true;this.sync.reconnect();this.sync.applyEnvelope(reply);
      if(reply.rejected){this.sync.acknowledgeRejection();this.onError(reply.error?.code??'COMMAND_REJECTED');return false;}
      return Boolean(reply.confirmed);
    }catch(error){
      if(error.definitive){this.sync.rejectPending({code:error.message});this.sync.acknowledgeRejection();this.onError(error.message);}
      else{this.disconnect();this.onError('CONNECTION_PENDING');}
      return false;
    }finally{this.busy=false;this.persistPending();this.onChange();}
  }
  async refresh(){
    if(!this.state||this.refreshing||this.busy)return;
    this.refreshing=true;
    try{
      const state=await this.request('snapshot',{matchId:this.state.id});
      this.online=true;this.sync.reconnect();this.sync.applyEnvelope({version:state.version,state});
      if(this.remaining()===0)this.preview=null;
      const pending=this.sync.pendingCommand();
      if(pending){
        const result=await this.request('recover',{matchId:this.state.id,commandId:pending.command.id});
        const resolution=this.sync.recover(result);
        if(resolution==='rejected'){this.onError(result.error?.code??'COMMAND_REJECTED');this.sync.acknowledgeRejection();}
        if(resolution==='retry-original'){
          // Always retry the exact original payload/ID. The server alone checks validity.
          await this.dispatch(pending.command);
        }
        this.persistPending();
      }
    }catch(error){
      if(error.definitive)this.onError(error.message);else this.disconnect();
    }finally{this.refreshing=false;this.onChange();}
  }
}
