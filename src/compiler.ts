import * as babel from '@babel/core'
import { parse } from '@babel/parser'
import { Header, Opcode } from './constant.js'

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

interface Stub {
  index: number,
  type: StubType
}

enum StubType {
  CONDITION_ELSE,
  CONDITION_END,
  LOOP_START,
  LOOP_UPDATE,
  LOOP_END,
  FUNCTION_START,
  OEP
}

class Context {
  private context: {
    variables: Map<string, number>
    counter: number
  }[] = []

  constructor() {
    this.push()
  }

  push() {
    this.context.push({
      variables: new Map<string, number>(),
      counter: 0
    })
  }

  pop() {
    this.context.pop()
  }

  get counter() {
    return this.context[this.context.length - 1].counter
  }

  incr() {
    return this.context[this.context.length - 1].counter++
  }

  get(name: string) {
    return this.context[this.context.length - 1].variables.get(name)
  }

  has(name: string) {
    return this.context[this.context.length - 1].variables.has(name)
  }

  set(name: string, value: number) {
    this.context[this.context.length - 1].variables.set(name, value)
  }
}

export default class Compiler {
  ast: babel.types.File
  context: Context
  dependencies: string[]
  dependenciesUnderWindow: string[]
  ir: Block
  private readonly stubStack: Stub[]
  private stubCounter: number
  private readonly functionTable: Map<string, Stub>

  constructor(source: string) {
    this.ast = this.parse(source)
    this.context = new Context()
    this.dependencies = ['window', 'console']
    this.dependenciesUnderWindow = ['Array', 'ArrayBuffer', 'Atomics', 'Boolean', 'DataView', 'Date', 'Error',
      'EvalError', 'Float32Array', 'Float64Array', 'Function', 'Infinity', 'Int16Array', 'Int32Array',
      'Int8Array', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object', 'Promise', 'Proxy', 'RangeError',
      'ReferenceError', 'Reflect', 'RegExp', 'Set', 'String', 'Symbol', 'SyntaxError', 'TypeError', 'URIError',
      'Uint16Array', 'Uint32Array', 'Uint8Array', 'Uint8ClampedArray', 'WeakMap', 'WeakSet', 'alert', 'Object',
      'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'eval', 'isFinite',
      'isNaN', 'parseFloat', 'parseInt', 'undefined', 'unescape']
    this.ir = this.makeNewBlock()
    this.stubStack = []
    this.stubCounter = 0
    this.functionTable = new Map()
  }

  private parse(source: string) {
    const ast = babel.transformFromAstSync(parse(source), source, {
      ast: true,
      code: false,
      presets: ['@babel/preset-env']
    })?.ast
    if (!ast) throw 'TRANSFER_TO_ES5_FAILED'
    return ast
  }

  private isVariableInitialized(name: string): boolean {
    return this.context.has(name)
  }

  private initializeVariable(name: string, dst: number) {
    this.context.set(name, dst)
  }

  private isADependency(name: string) {
    return this.dependencies.includes(name)
  }

  private isADependencyUnderWindow(name: string) {
    return this.dependenciesUnderWindow.includes(name)
  }

  private isAFunction(name: string) {
    return this.functionTable.has(name)
  }

  private getDependencyPointer(name: string) {
    return this.dependencies.indexOf(name)
  }

  private pushInstruction(instruction: Instruction) {
    this.ir.instructions.push(instruction)
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

  private createAddrStubArgument(stub: Stub): InstructionArgument {
    return {
      type: Header.DYN_ADDR,
      value: stub.index
    }
  }

  private translateDependencyExpressionUnderWindow(node: babel.types.Identifier) {
    return this.translateExpression(babel.types.memberExpression(babel.types.identifier('window'), node))
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
        target = this.context.incr()
        this.appendPopInstruction(this.createNumberArgument(target))
        return this.createVariableArgument(target)

      case 'CallExpression':
        this.pushCallExpressionOntoStack(node)
        target = this.context.incr()
        this.appendPopInstruction(this.createNumberArgument(target))
        return this.createVariableArgument(target)

      case 'MemberExpression':
        this.pushMemberExpressionOntoStack(node)
        this.appendGetPropertyInstruction()
        target = this.context.incr()
        this.appendPopInstruction(this.createNumberArgument(target))
        return this.createVariableArgument(target)

      case 'BinaryExpression':
        this.translateBinaryExpression(node)
        target = this.context.incr()
        this.appendPopInstruction(this.createNumberArgument(target))
        return this.createVariableArgument(target)

      case 'LogicalExpression':
        this.translateLogicalExpression(node)
        target = this.context.incr()
        this.appendPopInstruction(this.createNumberArgument(target))
        return this.createVariableArgument(target)

      case 'StringLiteral':
        return this.createStringArgument(node.value)

      case 'Identifier':
        if (this.isADependency(node.name)) {
          return this.createDependencyArgument(this.getDependencyPointer(node.name))
        }
        if (this.isADependencyUnderWindow(node.name)) {
          return this.translateDependencyExpressionUnderWindow(node)
        }

        const reg = this.context.get(node.name)
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
          const reg = this.context.get(target.name)
          if (reg === undefined) {
            console.error(target.name)
            throw 'UNKNOWN_SOURCE_VARIABLE'
          }
          return this.createVariableArgument(reg)
        } else {
          this.appendPushInstruction(this.translateExpression(target))
          let expression = babel.types.binaryExpression(op, target, babel.types.numericLiteral(1))
          this.translateVariableAssignment(target, expression)
          target = this.context.incr()
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
      opcode: Opcode.NEG,
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

  private appendJmpInstruction() {
    this.pushInstruction({
      opcode: Opcode.JMP,
      args: []
    })
  }

  private appendJmpZeroInstruction() {
    this.pushInstruction({
      opcode: Opcode.JZ,
      args: []
    })
  }

  // private appendExitInstruction() {
  //     this.pushInstruction({
  //         opcode: Opcode.EXIT,
  //         args: []
  //     })
  // }

  // private appendExitIfInstruction() {
  //     this.pushInstruction({
  //         opcode: Opcode.EXIT_IF,
  //         args: []
  //     })
  // }

  private appendStubInstruction(addr: InstructionArgument) {
    this.pushInstruction({
      opcode: Opcode.ADDR_STUB,
      args: [addr]
    })
  }

  private appendPushStackFrameInstruction() {
    this.pushInstruction({
      opcode: Opcode.PUSH_STACK_FRAME,
      args: []
    })
  }

  private appendPopStackFrameInstruction() {
    this.pushInstruction({
      opcode: Opcode.POP_STACK_FRAME,
      args: []
    })
  }

  private declareArrVariable(): number {
    const target = this.context.incr()
    this.appendStoreInstruction([
      this.createNumberArgument(target),
      this.createArrayArgument()
    ])
    return target
  }

  private declareArrVariableWithValue(argument: babel.types.Expression | babel.types.SpreadElement | babel.types.JSXNamespacedName | babel.types.ArgumentPlaceholder | undefined | null): number {
    this.appendPushInstruction(this.translateExpression(argument))
    this.appendInitArrayInstruction()
    const target = this.context.incr()
    this.appendPopInstruction(this.createNumberArgument(target))
    return target
  }

  /**
   * 处理二元运算符
   */
  private translateBinaryExpression(node: babel.types.BinaryExpression) {
    if (node.left.type === 'PrivateName') throw 'UNHANDLED_PRIVATE_NAME'

    let left: InstructionArgument, right: InstructionArgument

    switch (node.operator) {
      case '==':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.EQUAL,
          args: []
        })
        break
      case '===':
        this.appendPushInstruction(
          this.translateExpression(
            babel.types.logicalExpression(
              '&&',
              babel.types.binaryExpression(
                '==',
                node.left,
                node.right
              ),
              babel.types.binaryExpression(
                '==',
                babel.types.unaryExpression('typeof', node.left),
                babel.types.unaryExpression('typeof', node.right)
              )
            )
          )
        )
        break
      case '!=':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.NOT_EQUAL,
          args: []
        })
        break
      case '!==':
        this.appendPushInstruction(
          this.translateExpression(
            babel.types.logicalExpression(
              '||',
              babel.types.binaryExpression(
                '!=',
                node.left,
                node.right
              ),
              babel.types.binaryExpression(
                '!=',
                babel.types.unaryExpression('typeof', node.left),
                babel.types.unaryExpression('typeof', node.right)
              )
            )
          )
        )
        break
      case '+':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.ADD,
          args: []
        })
        break
      case '-':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.SUB,
          args: []
        })
        break
      case '*':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.MUL,
          args: []
        })
        break
      case '/':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.DIV,
          args: []
        })
        break
      case '%':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.MOD,
          args: []
        })
        break
      case '<':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.LESS_THAN,
          args: []
        })
        break
      case '<=':
        this.appendPushInstruction(
          this.translateExpression(
            babel.types.logicalExpression(
              '||',
              babel.types.binaryExpression(
                '<',
                node.left,
                node.right
              ),
              babel.types.binaryExpression(
                '==',
                node.left,
                node.right
              )
            )
          )
        )
        break
      case '>':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.GREATER_THAN,
          args: []
        })
        break
      case '>=':
        this.appendPushInstruction(
          this.translateExpression(
            babel.types.logicalExpression(
              '||',
              babel.types.binaryExpression(
                '>',
                node.left,
                node.right
              ),
              babel.types.binaryExpression(
                '==',
                node.left,
                node.right
              )
            )
          )
        )
        break
      case '&':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.BITWISE_AND,
          args: []
        })
        break
      case '|':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.BITWISE_OR,
          args: []
        })
        break
      case '^':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.BITWISE_XOR,
          args: []
        })
        break
      case '<<':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.BITWISE_LEFT_SHIFT,
          args: []
        })
        break
      case '>>':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.BITWISE_RIGHT_SHIFT,
          args: []
        })
        break
      case '**':
        this.appendPushInstruction(
          this.translateExpression(
            babel.types.callExpression(
              babel.types.memberExpression(
                babel.types.identifier('Math'),
                babel.types.identifier('pow')
              ),
              [node.left, node.right]
            )
          )
        )
        break
      default:
        throw 'UNHANDLED_OPERATOR_BINARY_EXPRESSION'
    }
  }

  private translateLogicalExpression(node: babel.types.LogicalExpression) {
    const left = this.translateExpression(node.left)
    const right = this.translateExpression(node.right)

    switch (node.operator) {
      case '&&':
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.AND,
          args: []
        })
        break
      case '||':
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.OR,
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
        } else if (this.isADependencyUnderWindow(node.object.name)) {
          this.appendPushInstruction(this.translateDependencyExpressionUnderWindow(node.object))
        } else {
          console.error(node.object.name)
          throw 'BASE_NOT_DEPENDENCY'
        }
        if (node.property.type !== 'Identifier') throw 'UNSUPPORTED_PROPERTY_TYPE'
        break

      case 'CallExpression':
        this.pushCallExpressionOntoStack(node.object)
        break

      case 'MemberExpression':
        this.pushMemberExpressionOntoStack(node.object)
        this.appendGetPropertyInstruction()
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
      const argumentArr = this.declareArrVariableWithValue(argument)

      // pushes a reference onto stack
      this.appendPushInstruction(this.createArrayArgument())
      this.appendPushInstruction(this.createStringArgument('push'))

      this.appendGetPropertyInstruction()

      this.appendPushInstruction(this.createVariableArgument(argumentsArrayToCall))
      this.appendPushInstruction(this.createVariableArgument(argumentArr))

      this.appendApplyInstruction()
    })

    return argumentsArrayToCall
  }

  private pushCallExpressionOntoStack(node: babel.types.CallExpression) {
    const targetOfCallArguments = this.pushCallArgumentsOntoStack(node.arguments)
    switch (node.callee.type) {
      case 'MemberExpression':
        this.pushMemberExpressionOntoStack(node.callee)
        this.appendGetPropertyInstruction()
        this.appendPushInstruction(this.createUndefinedArgument())
        this.appendPushInstruction(this.createVariableArgument(targetOfCallArguments))
        this.appendApplyInstruction()
        break

      case 'Identifier':
        this.appendPushInstruction(this.translateExpression(node.callee))
        this.appendPushInstruction(this.createUndefinedArgument())
        this.appendPushInstruction(this.createVariableArgument(targetOfCallArguments))
        this.appendApplyInstruction()
        break

      default:
        console.error(node.callee.type)
        throw 'UNHANDLED_CALL_EXPRESSION_TYPE'
    }
    // remove reference? not sure what is occupying the stack
    // this.appendPopInstruction(this.createUndefinedArgument())
  }

  private makeNewBlock(): Block {
    return {
      instructions: [],
      inheritsContext: true
    }
  }

  private makeStub(type: StubType): Stub {
    const index = this.stubCounter++
    return {index, type}
  }

  private translateWhileLoop(node: babel.types.WhileStatement) {
    this.translateForLoop(babel.types.forStatement(null, node.test, null, node.body))
  }

  private translateForLoop(node: babel.types.ForStatement) {
    if (node.init) {
      if (node.init.type === 'VariableDeclaration') {
        this.buildIR([node.init])
      } else if (babel.types.isExpression(node.init)) {
        this.buildIR([babel.types.expressionStatement(node.init)])
      }
    }

    const stub_begin = this.makeStub(StubType.LOOP_START)
    const stub_update = this.makeStub(StubType.LOOP_UPDATE)
    const stub_end = this.makeStub(StubType.LOOP_END)
    this.stubStack.push(stub_begin, stub_update, stub_end)

    this.appendStubInstruction(this.createAddrStubArgument(stub_begin))

    this.appendPushInstruction(this.translateExpression(node.test))
    this.appendPushInstruction(this.createAddrStubArgument(stub_end))
    this.appendJmpZeroInstruction()

    this.buildIR(node.body.type === 'BlockStatement' ? node.body.body : [node.body])

    this.appendStubInstruction(this.createAddrStubArgument(stub_update))
    if (node.update) {
      this.buildIR([babel.types.expressionStatement(node.update)])
    }

    this.appendPushInstruction(this.createAddrStubArgument(stub_begin))
    this.appendJmpInstruction()

    this.appendStubInstruction(this.createAddrStubArgument(stub_end))

    this.stubStack.splice(-3)
  }

  private translateIfStatement(node: babel.types.IfStatement) {
    // let block = this.makeNewBlock()
    // push the expression onto the stack
    this.appendPushInstruction(this.translateExpression(node.test))

    if (!node.alternate) {
      const stub = this.makeStub(StubType.CONDITION_END)
      this.appendPushInstruction(this.createAddrStubArgument(stub))
      this.appendJmpZeroInstruction()
      if (node.consequent.type === 'BlockStatement') {
        this.buildIR(node.consequent.body)
      } else {
        this.buildIR([node.consequent])
      }
      this.appendStubInstruction(this.createAddrStubArgument(stub))
    } else {
      const stub_else = this.makeStub(StubType.CONDITION_ELSE)
      const stub_end = this.makeStub(StubType.CONDITION_END)
      this.appendPushInstruction(this.createAddrStubArgument(stub_else))
      this.appendJmpZeroInstruction()

      this.buildIR(node.consequent.type === 'BlockStatement' ? node.consequent.body : [node.consequent])

      this.appendPushInstruction(this.createAddrStubArgument(stub_end))
      this.appendJmpInstruction()
      this.appendStubInstruction(this.createAddrStubArgument(stub_else))

      this.buildIR(node.alternate.type === 'BlockStatement' ? node.alternate.body : [node.alternate])
      this.appendStubInstruction(this.createAddrStubArgument(stub_end))
    }
  }

  private translateVariableDeclaration(node: babel.types.VariableDeclaration) {
    node.declarations.forEach(declaration => {
      if (declaration.id.type !== 'Identifier') {
        throw 'UNHANDLED_VARIABLE_DECL_ID'
      }

      if (this.isVariableInitialized(declaration.id.name)) {
        this.translateVariableAssignment(declaration.id, declaration.init)
      } else {
        const target = this.context.incr()
        this.initializeVariable(declaration.id.name, target)

        this.appendStoreInstruction([
          this.createNumberArgument(target),
          this.translateExpression(declaration.init)
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

    const reg = this.context.get(node.name)
    if (reg === undefined) {
      throw 'UNHANDLED'
    }

    this.appendStoreInstruction([
      this.createNumberArgument(reg),
      this.translateExpression(value)
    ])
  }

  private translateFunctionDeclaration(node: babel.types.FunctionDeclaration) {
    if (node.id === null) {
      throw 'FUNCTION_DECLARATION_ID_NULL'
    }
    if (node.id.type !== 'Identifier') {
      throw 'FUNCTION_DECLARATION_ID_TYPE'
    }
    const stub = this.makeStub(StubType.FUNCTION_START)
    this.functionTable.set(node.id.name, stub)
    this.appendStubInstruction(this.createAddrStubArgument(stub))

    this.context.push()

    this.appendStubInstruction(this.createAddrStubArgument(stub))

    this.buildIR(node.body.body)

    this.appendPopStackFrameInstruction()
    this.context.pop()
  }

  private buildIR(statements: babel.types.Statement[], isMain = false) {
    const oepStub: Stub = {index: -1, type: StubType.OEP}
    let oepSet = false

    if (isMain) {
      this.appendPushInstruction(this.createAddrStubArgument(oepStub))
      this.appendJmpInstruction()
    }

    statements.forEach(statement => {
      let stub: Stub = undefined

      if (isMain && !oepSet && statement.type !== 'FunctionDeclaration') {
        this.appendStubInstruction(this.createAddrStubArgument(oepStub))
        oepSet = true
      }

      switch (statement.type) {
        case 'IfStatement':
          this.translateIfStatement(statement)
          break

        case 'WhileStatement':
          this.translateWhileLoop(statement)
          break

        case 'ForStatement':
          this.translateForLoop(statement)
          break

        case 'VariableDeclaration':
          this.translateVariableDeclaration(statement)
          break

        case 'ExpressionStatement':
          switch (statement.expression.type) {
            case 'CallExpression':
              if (statement.expression.callee.type === 'Identifier' && this.isAFunction(statement.expression.callee.name)) {
                const stub = this.functionTable.get(statement.expression.callee.name)
                if (stub === undefined) throw 'FUNCTION_STUB_NOT_FOUND'
                this.appendPushStackFrameInstruction()
                this.appendPushInstruction(this.createAddrStubArgument(stub))
                this.appendJmpInstruction()
                // The above code must satisfy opcode length = 10
              } else {
                this.pushCallExpressionOntoStack(statement.expression)
              }
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

        case 'BreakStatement':
          for (let i = this.stubStack.length - 1; i >= 0; i--) {
            if (this.stubStack[i].type === StubType.LOOP_END) {
              stub = this.stubStack[i]
              break
            }
          }
          if (stub === undefined) throw 'BREAK_STATEMENT_END_STUB_NOT_FOUND'

          this.appendPushInstruction(this.createAddrStubArgument(stub))
          this.appendJmpInstruction()
          break

        case 'ContinueStatement':
          for (let i = this.stubStack.length - 1; i >= 0; i--) {
            if (this.stubStack[i].type === StubType.LOOP_UPDATE) {
              stub = this.stubStack[i]
              break
            }
          }
          if (stub === undefined) throw 'BREAK_STATEMENT_UPDATE_STUB_NOT_FOUND'

          this.appendPushInstruction(this.createAddrStubArgument(stub))
          this.appendJmpInstruction()
          break

        case 'FunctionDeclaration':
          this.translateFunctionDeclaration(statement)
          break

        default:
          console.error(statement.type)
          throw 'UNHANDLED_NODE'
      }
    })
  }

  compile() {
    this.buildIR(this.ast.program.body, true)
    return this.ir
  }
}
