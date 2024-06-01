const {disassemble} = require('@kprotect/debugger');

const bundle = {
    bytecode: new Uint8Array( [
            31, 101,   0,   0,   0,   0,   0, 0,  0,  0,  37, 103,
            0,  30, 101,  25,   0,   0,   0, 0,  0,  0,   0,  20,
            39,   8, 101,   0,   0,   0,   0, 0,  0,  0,   0, 105,
            0,  30, 103,   0,  33, 101,   1, 0,  0,  0,   0,   0,
            0,   0,  31, 101,   1,   0,   0, 0,  0,  0,   0,   0,
            30, 104,   1,  30, 100,   0,   0, 0,  0,  0,   0,   0,
            0,   9,  30, 104,   1,  30, 103, 1, 16, 31, 106,  30,
            106,  38
        ]
    ),
    strings: [ 'log' ]
}
const result = disassemble(bundle.bytecode, bundle.strings);
console.log(result);
