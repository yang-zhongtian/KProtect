import VM from './vm';
import payload from './bundle.json';
export default () => {
    new VM(payload.bytecode, payload.strings, payload.lookUpTable).start();
};
