import * as babel from '@babel/core'
import {parse} from '@babel/parser'
import {Header, Opcode} from './constant.js'

export interface Context {
    variables: Map<string, number>
    counter: number
}

export interface InstructionArgument {
    type: Header
    value: any
}

export interface Instruction {
    opcode: Opcode
    args: InstructionArgument[]
}

export interface Block {
    instructions: Instruction[]
    inheritsContext: boolean,
}

export interface IntermediateLanguage {
    [Label: string]: Block
}

export default class Compiler {
    ast: babel.types.File
    contexts: Context[]
    dependencies: string[]
    dependenciesUnderWindow: string[]
    blocks: Block[]
    il: IntermediateLanguage

    constructor(source: string) {
        this.ast = this.parse(source)
        this.contexts = [{
            variables: new Map<string, number>(),
            counter: 0
        }]
        this.dependencies = ['window', 'console']
        this.dependenciesUnderWindow = ['Array', 'ArrayBuffer', 'Atomics', 'Boolean', 'DataView', 'Date', 'Error',
            'EvalError', 'Float32Array', 'Float64Array', 'Function', 'Infinity', 'Int16Array', 'Int32Array',
            'Int8Array', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object', 'Promise', 'Proxy', 'RangeError',
            'ReferenceError', 'Reflect', 'RegExp', 'Set', 'String', 'Symbol', 'SyntaxError', 'TypeError', 'URIError',
            'Uint16Array', 'Uint32Array', 'Uint8Array', 'Uint8ClampedArray', 'WeakMap', 'WeakSet', 'alert', 'Object',
            'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'eval', 'isFinite',
            'isNaN', 'parseFloat', 'parseInt', 'undefined', 'unescape']
        const block: Block = {
            instructions: [],
            inheritsContext: true,
        }
        this.blocks = [block]
        this.il = {'main': block}
    }

    private parse(source: string) {
        const ast = babel.transformFromAstSync(parse(source), source, {
            ast: true,
            code: false,
            presets: ['@babel/preset-env'],
        })?.ast
        if (!ast) throw 'TRANSFER_TO_ES5_FAILED'
        return ast
    }

    private isVariableInitialized(name: string): boolean {
        return this.contexts[0].variables.has(name)
    }

    private initializeVariable(name: string, dst: number) {
        this.contexts[0].variables.set(name, dst)
    }

    private isADependency(name: string) {
        return this.dependencies.includes(name)
    }

    private isADependencyUnderWindow(name: string) {
        return this.dependenciesUnderWindow.includes(name)
    }

    private getDependencyPointer(name: string) {
        return this.dependencies.indexOf(name)
    }

    private getDependencyExpressionUnderWindow(node: babel.types.Identifier) {
        return babel.types.memberExpression(babel.types.identifier('window'), node)
    }

    private pushInstruction(instruction: Instruction) {
        this.blocks[0].instructions.push(instruction)
    }

    private createNumberArgument(dst: number): InstructionArgument {
        return {
            type: Header.LOAD_NUMBER,
            value: dst
        }
    }

    private createArrayArgument(): InstructionArgument {
        return {
            type: Header.LOAD_ARRAY,
            value: null
        }
    }

    private createUndefinedArgument(): InstructionArgument {
        return {
            type: Header.LOAD_UNDEFINED,
            value: null
        }
    }

    private createDependencyArgument(pointer: number): InstructionArgument {
        return {
            type: Header.FETCH_DEPENDENCY,
            value: pointer
        }
    }

    private createStringArgument(value: string): InstructionArgument {
        return {
            type: Header.LOAD_STRING,
            value: value
        }
    }

    private createVariableArgument(dst: number): InstructionArgument {
        return {
            type: Header.FETCH_VARIABLE,
            value: dst
        }
    }

    private translateUnaryExpression(node: babel.types.UnaryExpression) {
        this.appendPushInstruction(this.translateExpression(node.argument))

        switch (node.operator) {
            case 'typeof':
                this.appendTypeofInstruction()
                break
            case '!':
                this.appendNotInstruction()
                break
            default:
                console.error(node.operator)
                throw 'UNSUPPORTED_UNARY_TYPE'
        }
    }

    private translateExpression(node: babel.types.Expression | babel.types.SpreadElement | babel.types.JSXNamespacedName | babel.types.ArgumentPlaceholder | undefined | null): InstructionArgument {
        if (node === undefined || node === null) {
            return {
                type: Header.LOAD_UNDEFINED,
                value: null
            }
        }
        let target
        switch (node.type) {
            case 'UnaryExpression':
                this.translateUnaryExpression(node)
                target = this.contexts[0].counter++
                this.appendPopInstruction(this.createNumberArgument(target))
                return this.createVariableArgument(target)

            case 'CallExpression':
                this.pushCallExpressionOntoStack(node)
                target = this.contexts[0].counter++
                this.appendPopInstruction(this.createNumberArgument(target))
                return this.createVariableArgument(target)

            case 'MemberExpression':
                this.pushMemberExpressionOntoStack(node)
                this.appendGetPropertyInstruction()
                target = this.contexts[0].counter++
                this.appendPopInstruction(this.createNumberArgument(target))
                return this.createVariableArgument(target)

            case 'BinaryExpression':
                this.translateBinaryExpression(node)
                target = this.contexts[0].counter++
                this.appendPopInstruction(this.createNumberArgument(target))
                return this.createVariableArgument(target)

            case 'StringLiteral':
                return this.createStringArgument(node.value)

            case 'Identifier':
                if (this.isADependency(node.name)) {
                    return this.createDependencyArgument(this.getDependencyPointer(node.name))
                }
                if (this.isADependencyUnderWindow(node.name)) {
                    return this.translateExpression(this.getDependencyExpressionUnderWindow(node))
                }

                const reg = this.contexts[0].variables.get(node.name)
                if (reg === undefined) {
                    console.error(node.name)
                    throw 'UNKNOWN_SOURCE_VARIABLE'
                }
                return this.createVariableArgument(reg)

            case 'NumericLiteral':
                return this.createNumberArgument(node.value)

            case 'UpdateExpression':
                target = node.argument
                if (target.type !== 'Identifier') throw 'INVALID_UPDATE'
                const op = node.operator === '++' ? '+' : '-'
                if (node.prefix) {
                    let expression = babel.types.binaryExpression(op, target, babel.types.numericLiteral(1))
                    this.translateVariableAssignment(target, expression)
                    const reg = this.contexts[0].variables.get(target.name)
                    if (reg === undefined) {
                        console.error(target.name)
                        throw 'UNKNOWN_SOURCE_VARIABLE'
                    }
                    return this.createVariableArgument(reg)
                } else {
                    this.appendPushInstruction(this.translateExpression(target))
                    let expression = babel.types.binaryExpression(op, target, babel.types.numericLiteral(1))
                    this.translateVariableAssignment(target, expression)
                    target = this.contexts[0].counter++
                    this.appendPopInstruction(this.createNumberArgument(target))
                    return this.createVariableArgument(target)
                }
            default:
                console.error(node)
                throw 'UNHANDLED_VALUE'
        }
    }

    private appendNotInstruction() {
        this.pushInstruction({
            opcode: Opcode.NOT,
            args: []
        })
    }

    private appendTypeofInstruction() {
        this.pushInstruction({
            opcode: Opcode.TYPEOF,
            args: []
        })
    }

    private appendStoreInstruction(args: InstructionArgument[]) {
        this.pushInstruction({
            opcode: Opcode.STORE,
            args: args
        })
    }

    private appendGetPropertyInstruction() {
        this.pushInstruction({
            opcode: Opcode.GET_PROPERTY,
            args: []
        })
    }

    private appendCallMemberExpression() {
        this.pushInstruction({
            opcode: Opcode.CALL_MEMBER_EXPRESSION,
            args: []
        })
    }

    private appendPushInstruction(arg: InstructionArgument) {
        this.pushInstruction({
            opcode: Opcode.PUSH,
            args: [arg]
        })
    }

    private appendPopInstruction(arg: InstructionArgument) {
        this.pushInstruction({
            opcode: Opcode.POP,
            args: [arg]
        })
    }

    private appendCallInstruction() {
        this.pushInstruction({
            opcode: Opcode.CALL,
            args: []
        })
    }

    private appendApplyInstruction() {
        this.pushInstruction({
            opcode: Opcode.APPLY,
            args: []
        })
    }

    private appendInitArrayInstruction() {
        this.pushInstruction({
            opcode: Opcode.INIT_ARRAY,
            args: []
        })
    }

    private appendJmpInstruction(arg: InstructionArgument, traceback = true) {
        this.pushInstruction({
            opcode: traceback ? Opcode.JMP : Opcode.JMP_NO_TRACEBACK,
            args: [arg],
        })
    }

    private appendJmpIfElseInstruction(arg$1: InstructionArgument, arg$2: InstructionArgument) {
        this.pushInstruction({
            opcode: Opcode.JMP_IF_ELSE,
            args: [arg$1, arg$2],
        })
    }

    private appendExitInstruction() {
        this.pushInstruction({
            opcode: Opcode.EXIT,
            args: []
        })
    }

    private appendExitIfInstruction() {
        this.pushInstruction({
            opcode: Opcode.EXIT_IF,
            args: []
        })
    }

    private declareArrVariable(): number {
        const target = this.contexts[0].counter++
        this.appendStoreInstruction([
            this.createNumberArgument(target),
            this.createArrayArgument()
        ])
        return target
    }

    private declareArrVariableWithValue(argument: babel.types.Expression | babel.types.SpreadElement | babel.types.JSXNamespacedName | babel.types.ArgumentPlaceholder | undefined | null): number {
        this.appendPushInstruction(this.translateExpression(argument))
        this.appendInitArrayInstruction()
        const target = this.contexts[0].counter++
        this.appendPopInstruction(this.createNumberArgument(target))
        return target
    }

    /**
     * 处理二元运算符
     */
    private translateBinaryExpression(node: babel.types.BinaryExpression) {
        if (node.left.type === 'PrivateName') throw 'UNHANDLED_PRIVATE_NAME'

        const left = this.translateExpression(node.left)
        const right = this.translateExpression(node.right)

        this.appendPushInstruction(left)
        this.appendPushInstruction(right)

        switch (node.operator) {
            case '==':
                this.pushInstruction({
                    opcode: Opcode.EQUAL,
                    args: []
                })
                break
            case '===':
                this.pushInstruction({
                    opcode: Opcode.STRICT_EQUAL,
                    args: []
                })
                break
            case '!=':
                this.pushInstruction({
                    opcode: Opcode.NOT_EQUAL,
                    args: []
                })
                break
            case '!==':
                this.pushInstruction({
                    opcode: Opcode.STRICT_NOT_EQUAL,
                    args: []
                })
                break
            case '+':
                this.pushInstruction({
                    opcode: Opcode.ADD,
                    args: []
                })
                break
            case '-':
                this.pushInstruction({
                    opcode: Opcode.SUB,
                    args: []
                })
                break
            case '*':
                this.pushInstruction({
                    opcode: Opcode.MUL,
                    args: []
                })
                break
            case '/':
                this.pushInstruction({
                    opcode: Opcode.DIV,
                    args: []
                })
                break
            case '%':
                this.pushInstruction({
                    opcode: Opcode.MOD,
                    args: []
                })
                break
            case '<':
                this.pushInstruction({
                    opcode: Opcode.LESS_THAN,
                    args: []
                })
                break
            case '<=':
                this.pushInstruction({
                    opcode: Opcode.LESS_THAN_EQUAL,
                    args: []
                })
                break
            case '>':
                this.pushInstruction({
                    opcode: Opcode.GREATER_THAN,
                    args: []
                })
                break
            case '>=':
                this.pushInstruction({
                    opcode: Opcode.GREATER_THAN_EQUAL,
                    args: []
                })
                break
            default:
                throw 'UNHANDLED_OPERATOR_BINARY_EXPRESSION'
        }
    }

    private pushMemberExpressionOntoStack(node: babel.types.MemberExpression) {
        switch (node.object.type) {
            case 'Identifier':
                // 举例:
                // console.log("test") ->
                // var bb = console["log"]
                // bb("test")

                // 依赖命中
                if (this.isADependency(node.object.name)) {
                    this.appendPushInstruction(this.createDependencyArgument(this.getDependencyPointer(node.object.name)))
                } else {
                    console.error(node.object.name)
                    throw 'BASE_NOT_DEPENDENCY'
                }
                if (node.property.type !== 'Identifier') throw 'UNSUPPORTED_PROPERTY_TYPE'
                break

            case 'CallExpression':
                this.pushCallExpressionOntoStack(node.object)
                break

            default:
                console.error(node.object)
                throw 'UNHANDLED_MEMBER_EXPRESSION_STATE'
        }

        if (node.property.type !== 'Identifier') throw 'UNHANDLED_PROPERTY_TYPE'

        this.appendPushInstruction(this.createStringArgument(node.property.name))
    }


    // We translate call arguments by constructing an array of all elements
    // 1) Defining a new variable with empty array
    // 2) EXEC Push this variable reference onto stack
    // 3) EXEC Push "push" string onto stack
    // 4) EXEC Get_Property and pushes onto top of stack
    // 5) EXEC Push "argument"
    // 6) EXEC Call
    // returns a pointer to the arguments array
    private pushCallArgumentsOntoStack(args: Array<babel.types.Expression | babel.types.SpreadElement | babel.types.JSXNamespacedName | babel.types.ArgumentPlaceholder>): number {
        // define argument array
        const argumentsArrayToCall = this.declareArrVariable()

        args.forEach(argument => {
            const initializedArrPointer = this.declareArrVariableWithValue(argument)

            // pushes a reference onto stack
            this.appendPushInstruction(this.createArrayArgument())
            this.appendPushInstruction(this.createStringArgument('push'))

            this.appendGetPropertyInstruction()

            this.appendPushInstruction(this.createVariableArgument(argumentsArrayToCall))
            this.appendPushInstruction(this.createVariableArgument(initializedArrPointer))

            this.appendApplyInstruction()
        })

        return argumentsArrayToCall
    }

    private pushCallExpressionOntoStack(node: babel.types.CallExpression) {
        const targetOfCallArguments = this.pushCallArgumentsOntoStack(node.arguments)
        switch (node.callee.type) {
            case 'MemberExpression':
                this.pushMemberExpressionOntoStack(node.callee)

                this.appendPushInstruction(this.createVariableArgument(targetOfCallArguments))
                this.appendCallMemberExpression()
                break

            case 'Identifier':
                this.appendPushInstruction(this.translateExpression(node.callee))
                this.appendPushInstruction(this.createVariableArgument(targetOfCallArguments))
                this.appendCallInstruction()
                break

            default:
                console.error(node.callee.type)
                throw 'UNHANDLED_CALL_EXPRESSION_TYPE'
        }
        // remove reference? not sure what is occupying the stack
        this.appendPopInstruction(this.createUndefinedArgument())
    }

    private translateWhileLoop(node: babel.types.WhileStatement) {
        let block: Block = {
            instructions: [],
            inheritsContext: true,
        }
        const label = `while_${node.start}:${node.end}`

        this.appendJmpInstruction(this.createStringArgument(label))
        this.il[label] = block

        this.blocks.unshift(block)
        this.appendPushInstruction(this.translateExpression(node.test))
        this.appendNotInstruction()
        this.appendExitIfInstruction()

        if (node.body.type === 'BlockStatement') {
            this.buildIL(node.body.body)
        } else {
            this.buildIL([node.body])
        }

        this.appendJmpInstruction(this.createStringArgument(label), false)
        this.blocks.shift()
    }

    private translateIfStatement(node: babel.types.IfStatement) {
        let block: Block = {
            instructions: [],
            inheritsContext: true,
        }
        const if_label = `if_${node.start}:${node.end}`
        const else_label = `else_${node.start}:${node.end}`
        // push the expression onto the stack
        this.appendPushInstruction(this.translateExpression(node.test))

        if (!node.alternate) {
            this.appendJmpIfElseInstruction(this.createStringArgument(if_label), this.createUndefinedArgument())
        } else {
            this.appendJmpIfElseInstruction(this.createStringArgument(if_label), this.createStringArgument(else_label))
        }
        this.il[if_label] = block

        this.blocks.unshift(block)
        if (node.consequent.type === 'BlockStatement') {
            this.buildIL(node.consequent.body)
        } else {
            this.buildIL([node.consequent])
        }
        this.appendExitInstruction()
        this.blocks.shift()

        if (!node.alternate) return

        block = {
            instructions: [],
            inheritsContext: true,
        }
        this.il[else_label] = block

        this.blocks.unshift(block)
        if (node.alternate.type === 'BlockStatement') {
            this.buildIL(node.alternate.body)
        } else {
            this.buildIL([node.alternate])
        }
        this.appendExitInstruction()
        this.blocks.shift()
    }

    private translateVariableDeclaration(node: babel.types.VariableDeclaration) {
        node.declarations.forEach(declaration => {
            if (declaration.id.type !== 'Identifier') {
                throw 'UNHANDLED_VARIABLE_DECL_ID'
            }

            if (this.isVariableInitialized(declaration.id.name)) {
                this.translateVariableAssignment(declaration.id, declaration.init)
            } else {
                const target = this.contexts[0].counter++
                this.initializeVariable(declaration.id.name, target)

                this.appendStoreInstruction([
                    this.createNumberArgument(target),
                    this.translateExpression(declaration.init),
                ])
            }
        })
    }

    private translateVariableAssignment(node: babel.types.LVal, value: babel.types.Expression | null | undefined) {
        if (node.type !== 'Identifier') {
            throw 'UNHANDLED_VARIABLE_DECL_ID'
        }

        if (!this.isVariableInitialized(node.name)) {
            throw 'VARIABLE_NOT_DEFINED'
        }

        const reg = this.contexts[0].variables.get(node.name)
        if (reg === undefined) {
            throw 'UNHANDLED'
        }

        this.appendStoreInstruction([
            this.createNumberArgument(reg),
            this.translateExpression(value),
        ])
    }

    private buildIL(statements: babel.types.Statement[]) {
        statements.forEach(statement => {
            switch (statement.type) {
                case 'IfStatement':
                    this.translateIfStatement(statement)
                    break

                case 'WhileStatement':
                    this.translateWhileLoop(statement)
                    break

                case 'VariableDeclaration':
                    this.translateVariableDeclaration(statement)
                    break

                case 'ExpressionStatement':
                    switch (statement.expression.type) {
                        case 'CallExpression':
                            this.pushCallExpressionOntoStack(statement.expression)
                            // Pop the return data of the calling from stack since it is not received.
                            this.appendPopInstruction(this.createUndefinedArgument())
                            break
                        case 'AssignmentExpression':
                            this.translateVariableAssignment(statement.expression.left, statement.expression.right)
                            break
                        case 'UpdateExpression':
                            this.translateExpression(statement.expression)
                            // Pop the update result
                            this.appendPopInstruction(this.createUndefinedArgument())
                            break
                        default:
                            console.error(statement.expression.type)
                            throw 'UNHANDLED_EXPRESSION_STATEMENT'
                    }
                    break
                default:
                    console.error(statement.type)
                    throw 'UNHANDLED_NODE'
            }
        })
    }

    compile() {
        this.buildIL(this.ast.program.body)
        return this.il
    }
}
