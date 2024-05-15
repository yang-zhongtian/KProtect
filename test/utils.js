const VM = require('@kprotect/vm')
const {protect} = require('@kprotect/compiler')

const runCase = (caseSrc) => {
    const result = protect(caseSrc);
    const vm = new VM(window, result.bytecode, result.strings)
    vm.start()
}

module.exports = {
    runCase
}
