import { EventEmitter } from 'events';

// Creamos una única instancia para toda la aplicación
const appEvents = new EventEmitter();

// Opcional: Esto evita advertencias si tienes muchos usuarios conectados
appEvents.setMaxListeners(0); 

export default appEvents;