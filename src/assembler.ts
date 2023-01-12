import {Block, InstructionArgument, IntermediateLanguage} from './compiler'
import {Header, Opcode} from './constant'
import {deflateRaw} from 'pako'

export interface VirtualMachineArguments {
    bytecode: number[]
    strings: string[]
    lookUpTable: LookUpTable
}

export interface LookUpTable {
    [Label: string]: number;
}

export default class BytecodeCompiler {
    private readonly il: IntermediateLanguage
    private readonly strings: string[]
    bytecode: Uint8Array
    lookUpTable: LookUpTable

    constructor(ir: IntermediateLanguage) {
        this.il = ir
        this.strings = []
        this.bytecode = new Uint8Array()
        this.lookUpTable = {}
    }

    private longToByteArray(long: number) {
        const byteArray = []
        for (let i = 0; i < 8; i++) {
            const byte = long & 0xff
            long = (long - byte) / 256
            byteArray.push(byte)
        }
        return byteArray
    }

    private compileInstructionArgument(arg: InstructionArgument): Header[] {
        const header = arg.type
        switch (header) {
            case Header.LOAD_UNDEFINED:
                return [header]
            case Header.LOAD_OBJECT:
                return [header]
            case Header.LOAD_ARRAY:
                return [header]
            case Header.LOAD_STRING:
                this.strings.push(arg.value)
                const stringPointer = this.longToByteArray(this.strings.length - 1)
                return [header, ...stringPointer]
            case Header.LOAD_NUMBER:
                return [header, ...this.longToByteArray(arg.value)]
            case Header.POP_STACK:
                return []
            case Header.FETCH_VARIABLE:
                return [header, arg.value]
            case Header.FETCH_DEPENDENCY:
                return [header, arg.value]
        }
    }

    private compileBlock(block: Block, bytes: number[]) {
        block.instructions.forEach(instruction => {
            const opcode = instruction.opcode
            if (opcode === undefined) throw 'UNHANDLED_OPCODE'

            if (opcode === Opcode.JMP_IF) {
                // need to implement a jmp look up table
                // console.log("JMP_IF", instruction.args[0])


                // console.log(bytes.length)
                // we need to put a placeholder of 9 bytes beforehand, so we can replace it later onwards when we add in the jmp locations

                bytes.push(Opcode.PUSH)
                bytes.push(...this.compileInstructionArgument({
                    type: Header.LOAD_STRING,
                    value: instruction.args[0].value
                    // TODO 已修改，原来是用label作为key完成xor
                }))
                bytes.push(opcode)

            } else {
                bytes.push(opcode)
                instruction.args.forEach(command => {
                    bytes.push(...this.compileInstructionArgument(command))
                })
            }
        })
    }

    compile(): { bytecode: string; strings: string[]; lookUpTable: LookUpTable } {
        const bytes: number[] = []

        for (const [label, block] of Object.entries(this.il)) {
            console.log(`Segment ${label}: ${bytes.length}`)

            this.lookUpTable[label] = bytes.length

            this.compileBlock(block, bytes)

            bytes.push(Opcode.EXIT)
        }

        this.bytecode = Uint8Array.from(bytes)

        const buffer: Uint8Array = deflateRaw(this.bytecode)

        return {
            bytecode: Buffer.from(buffer).toString('base64'),
            strings: this.strings,
            lookUpTable: this.lookUpTable
        }
    }

}