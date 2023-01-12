import * as babel from '@babel/core'
import {parse} from '@babel/parser'
import {Header, Opcode, Dependency} from './constant.js'

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
    inheritsContext: boolean
}

export interface IntermediateLanguage {
    [Label: string]: Block
}

export default class Compiler {
    ast: babel.types.File
    contexts: Context[]
    dependencies: string[]
    blocks: Block[]
    il: IntermediateLanguage

    constructor(source: string) {
        this.ast = parse(source)
        this.contexts = [{
            variables: new Map<string, number>(),
            counter: 0
        }]
        this.dependencies = Dependency.map(this.getObjectName)
        const block: Block = {
            instructions: [],
            inheritsContext: true,
        }
        this.blocks = [block]
        this.il = {'main': block}
    }

    private getObjectName(object: any) {
        if (typeof object === 'function') {
            return object.name ?? object.constructor.name
        } else if (typeof object === 'object') {
            return object.toString().match(/^\[object\s(?<s>.*)]$/)?.groups?.s
        } else if (typeof object === 'number') {
            return object.toString()
        }
        return String(object)
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

    private getDependencyPointer(name: string) {
        return this.dependencies.indexOf(name)
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

                const reg = this.contexts[0].variables.get(node.name)
                if (reg === undefined) throw 'UNKNOWN_SOURCE_VARIABLE'
                return this.createVariableArgument(reg)

            case 'NumericLiteral':
                return this.createNumberArgument(node.value)

            default:
                console.error(node.type)
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

    private appendJmpIfInstruction(arg: InstructionArgument) {
        this.pushInstruction({
            opcode: Opcode.JMP_IF,
            args: [arg]
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
                    const pointer = this.dependencies.indexOf(node.object.name)
                    this.appendPushInstruction(this.createDependencyArgument(pointer))
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
    }

    private translateWhileLoop(node: babel.types.WhileStatement) {
        console.error(node)
        throw 'WHILE_LOOP_UNSUPPORTED'
        // TODO 转译while
    }

    private translateIfStatement(node: babel.types.IfStatement) {
        let block: Block = {
            instructions: [],
            inheritsContext: true,
        }
        let label = `if_${node.start}:${node.end}`
        // push the expression onto the stack
        this.appendPushInstruction(this.translateExpression(node.test))

        this.appendJmpIfInstruction(this.createStringArgument(label))
        this.il[label] = block

        this.blocks.unshift(block)
        if (node.consequent.type === 'BlockStatement') {
            this.buildIL(node.consequent.body)
        } else {
            this.buildIL([node.consequent])
        }
        this.blocks.shift()

        if (!node.alternate) return

        block = {
            instructions: [],
            inheritsContext: true,
        }
        label = `else_${node.start}:${node.end}`
        // push the expression onto the stack
        this.appendPushInstruction(this.translateExpression(node.test))
        this.appendNotInstruction()

        this.appendJmpIfInstruction(this.createStringArgument(label))
        this.il[label] = block

        this.blocks.unshift(block)

        if (node.alternate.type === 'BlockStatement') {
            this.buildIL(node.alternate.body)
        } else {
            this.buildIL([node.alternate])
        }
        this.blocks.shift()
    }

    private translateVariableDeclaration(node: babel.types.VariableDeclaration) {
        node.declarations.forEach(declaration => {
            if (declaration.id.type !== 'Identifier') {
                throw 'UNHANDLED_VARIABLE_DECL_ID'
            }

            let target = this.contexts[0].counter++
            if (this.isVariableInitialized(declaration.id.name)) {
                const reg = this.contexts[0].variables.get(declaration.id.name)
                if (reg === undefined) {
                    throw 'UNHANDLED'
                }
                target = reg
            }

            this.appendStoreInstruction([
                this.createNumberArgument(target),
                this.translateExpression(declaration.init),
            ])
            this.initializeVariable(declaration.id.name, target)

        })
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
