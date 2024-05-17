import * as babel from '@babel/core'
import { parse } from '@babel/parser'
import { Header, Opcode } from './constant.js'
import chalk from 'chalk'

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
  LOGICAL_BYPASS,
  LOGICAL_END,
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
  private oepSet = false

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
      configFile: false,
      plugins: [],
      presets: []
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

  private createParameterArgument(index: number): InstructionArgument {
    return {
      type: Header.FETCH_PARAMETER,
      value: index
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
        this.pushInstruction({
          opcode: Opcode.TYPEOF,
          args: []
        })
        break
      case '!':
        this.pushInstruction({
          opcode: Opcode.NOT,
          args: []
        })
        break
      case '+':
        this.pushInstruction({
          opcode: Opcode.POS,
          args: []
        })
        break
      case '-':
        this.pushInstruction({
          opcode: Opcode.NEG,
          args: []
        })
        break
      case '~':
        this.pushInstruction({
          opcode: Opcode.BITWISE_NOT,
          args: []
        })
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
    let target: any
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

      case 'ArrayExpression':
        return this.createVariableArgument(this.buildArgumentsListVariable(node.elements))

      case 'ConditionalExpression':
        this.appendPushInstruction(this.translateExpression(node.test))
        const stub_else = this.makeStub(StubType.CONDITION_ELSE)
        const stub_end = this.makeStub(StubType.CONDITION_END)
        this.appendPushInstruction(this.createAddrStubArgument(stub_else))
        this.appendJmpZeroInstruction()

        this.appendPushInstruction(this.translateExpression(node.consequent))
        this.appendPushInstruction(this.createAddrStubArgument(stub_end))
        this.appendJmpInstruction()
        this.appendStubInstruction(this.createAddrStubArgument(stub_else))

        this.appendPushInstruction(this.translateExpression(node.alternate))
        this.appendStubInstruction(this.createAddrStubArgument(stub_end))

        target = this.context.incr()
        this.appendPopInstruction(this.createNumberArgument(target))
        return this.createVariableArgument(target)

      case 'BooleanLiteral':
        return this.createNumberArgument(node.value ? 1 : 0)

      case 'SequenceExpression':
        node.expressions.forEach(expression => {
          this.appendPushInstruction(this.translateExpression(expression))
        })
        target = this.context.incr()
        this.appendPopInstruction(this.createNumberArgument(target))
        return this.createVariableArgument(target)

      case 'AssignmentExpression':
        this.translateVariableAssignment(node.left, node.right)
        target = this.context.incr()
        this.appendPopInstruction(this.createNumberArgument(target))
        return this.createVariableArgument(target)

      default:
        throw `UNHANDLED_VALUE ${node.type}`
    }
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

  private appendSetPropertyInstruction(value: InstructionArgument) {
    this.pushInstruction({
      opcode: Opcode.SET_PROPERTY,
      args: [value]
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

  private appendBuildArrayInstruction(arg: InstructionArgument) {
    this.pushInstruction({
      opcode: Opcode.BUILD_ARRAY,
      args: [arg]
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

  private appendPushStackFrameInstruction(param: InstructionArgument) {
    this.pushInstruction({
      opcode: Opcode.PUSH_STACK_FRAME,
      args: [param]
    })
  }

  private appendPopStackFrameInstruction() {
    this.pushInstruction({
      opcode: Opcode.POP_STACK_FRAME,
      args: []
    })
  }

  /**
   * 处理二元运算符
   */
  private translateBinaryExpression(node: babel.types.BinaryExpression) {
    if (node.left.type === 'PrivateName') throw 'UNHANDLED_PRIVATE_NAME'

    let left: InstructionArgument, right: InstructionArgument
    let left_var: number, right_var: number

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
      case '!=':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.EQUAL,
          args: []
        })
        this.pushInstruction({
          opcode: Opcode.NOT,
          args: []
        })
        break
      case '===':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)

        left_var = this.context.incr()
        right_var = this.context.incr()
        this.appendPopInstruction(this.createNumberArgument(right_var))
        this.appendPopInstruction(this.createNumberArgument(left_var))

        this.appendPushInstruction(this.createVariableArgument(left_var))
        this.pushInstruction({
          opcode: Opcode.TYPEOF,
          args: []
        })
        this.appendPushInstruction(this.createVariableArgument(right_var))
        this.pushInstruction({
          opcode: Opcode.TYPEOF,
          args: []
        })
        this.pushInstruction({
          opcode: Opcode.EQUAL,
          args: []
        })

        this.appendPushInstruction(this.createVariableArgument(left_var))
        this.appendPushInstruction(this.createVariableArgument(right_var))
        this.pushInstruction({
          opcode: Opcode.EQUAL,
          args: []
        })

        this.pushInstruction({
          opcode: Opcode.BITWISE_AND,
          args: []
        })

        this.pushInstruction({
          opcode: Opcode.NOT,
          args: []
        })
        this.pushInstruction({
          opcode: Opcode.NOT,
          args: []
        })
        break
      case '!==':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)

        left_var = this.context.incr()
        right_var = this.context.incr()
        this.appendPopInstruction(this.createNumberArgument(right_var))
        this.appendPopInstruction(this.createNumberArgument(left_var))

        this.appendPushInstruction(this.createVariableArgument(left_var))
        this.pushInstruction({
          opcode: Opcode.TYPEOF,
          args: []
        })
        this.appendPushInstruction(this.createVariableArgument(right_var))
        this.pushInstruction({
          opcode: Opcode.TYPEOF,
          args: []
        })
        this.pushInstruction({
          opcode: Opcode.EQUAL,
          args: []
        })

        this.appendPushInstruction(this.createVariableArgument(left_var))
        this.appendPushInstruction(this.createVariableArgument(right_var))
        this.pushInstruction({
          opcode: Opcode.EQUAL,
          args: []
        })

        this.pushInstruction({
          opcode: Opcode.BITWISE_AND,
          args: []
        })

        this.pushInstruction({
          opcode: Opcode.NOT,
          args: []
        })
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
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)

        this.pushInstruction({
          opcode: Opcode.GREATER_THAN,
          args: []
        })

        this.pushInstruction({
          opcode: Opcode.NOT,
          args: []
        })
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
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)

        this.pushInstruction({
          opcode: Opcode.LESS_THAN,
          args: []
        })

        this.pushInstruction({
          opcode: Opcode.NOT,
          args: []
        })
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
      case '>>>':
        left = this.translateExpression(node.left)
        right = this.translateExpression(node.right)
        this.appendPushInstruction(left)
        this.appendPushInstruction(right)
        this.pushInstruction({
          opcode: Opcode.BITWISE_UNSIGNED_RIGHT_SHIFT,
          args: []
        })
        break
      default:
        throw `UNHANDLED_OPERATOR_BINARY_EXPRESSION ${node.operator}`
    }
  }

  private translateLogicalExpression(node: babel.types.LogicalExpression) {
    const left = this.translateExpression(node.left)

    const stub_bypass = this.makeStub(StubType.LOGICAL_BYPASS)
    const stub_end = this.makeStub(StubType.LOGICAL_END)

    switch (node.operator) {
      case '&&':
        this.appendPushInstruction(left)

        this.appendPushInstruction(this.createAddrStubArgument(stub_bypass))
        this.appendJmpZeroInstruction()

        this.appendPushInstruction(this.translateExpression(node.right))
        this.appendPushInstruction(this.createAddrStubArgument(stub_end))
        this.appendJmpInstruction()

        this.appendStubInstruction(this.createAddrStubArgument(stub_bypass))
        this.appendPushInstruction(this.createNumberArgument(0))

        this.appendStubInstruction(this.createAddrStubArgument(stub_end))
        break
      case '||':
        this.appendPushInstruction(left)

        this.appendPushInstruction(this.createAddrStubArgument(stub_bypass))
        this.appendJmpZeroInstruction()

        this.appendPushInstruction(this.createNumberArgument(1))
        this.appendPushInstruction(this.createAddrStubArgument(stub_end))
        this.appendJmpInstruction()

        this.appendStubInstruction(this.createAddrStubArgument(stub_bypass))
        this.appendPushInstruction(this.translateExpression(node.right))

        this.appendStubInstruction(this.createAddrStubArgument(stub_end))
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
          break
        }
        if (this.isADependencyUnderWindow(node.object.name)) {
          this.appendPushInstruction(this.translateDependencyExpressionUnderWindow(node.object))
          break
        }
        if (this.isVariableInitialized(node.object.name)) {
          const reg = this.context.get(node.object.name)
          if (reg === undefined) {
            console.error(node.object.name)
            throw 'VARIABLE_NOT_FOUND'
          }
          this.appendPushInstruction(this.createVariableArgument(reg))
          break
        }
        console.error(node.object.name)
        throw 'BASE_NOT_DEPENDENCY'

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

    switch (node.property.type) {
      case 'Identifier':
        if (this.isVariableInitialized(node.property.name)) {
          const reg = this.context.get(node.property.name)
          if (reg === undefined) {
            console.error(node.property.name)
            throw 'VARIABLE_NOT_FOUND'
          }
          this.appendPushInstruction(this.createVariableArgument(reg))
          break
        }
        this.appendPushInstruction(this.createStringArgument(node.property.name))
        break
      case 'NumericLiteral':
        this.appendPushInstruction(this.createNumberArgument(node.property.value))
        break
      case 'MemberExpression':
        this.pushMemberExpressionOntoStack(node.property)
        this.appendGetPropertyInstruction()
        break
      case 'BinaryExpression':
        this.translateBinaryExpression(node.property)
        break
      case 'UnaryExpression':
        this.translateUnaryExpression(node.property)
        break
      default:
        throw `UNHANDLED_PROPERTY_TYPE ${node.property.type}`
    }
  }

  /**
   * 处理函数调用参数，构建参数列表
   * @param args 参数列表
   * @return {number} 返回参数列表的指针
   */
  private buildArgumentsListVariable(args: Array<babel.types.Expression | babel.types.SpreadElement | babel.types.JSXNamespacedName | babel.types.ArgumentPlaceholder>): number {
    args.forEach(argument => {
      this.appendPushInstruction(this.translateExpression(argument))
    })

    this.appendBuildArrayInstruction(this.createNumberArgument(args.length))
    const target = this.context.incr()
    this.appendPopInstruction(this.createNumberArgument(target))
    return target
  }

  private pushCallExpressionOntoStack(node: babel.types.CallExpression) {
    const targetOfCallArguments = this.buildArgumentsListVariable(node.arguments)

    switch (node.callee.type) {
      case 'MemberExpression':
        this.pushMemberExpressionOntoStack(node.callee)
        this.appendGetPropertyInstruction()
        this.appendPushInstruction(this.translateExpression(node.callee.object))
        this.appendPushInstruction(this.createVariableArgument(targetOfCallArguments))
        this.appendApplyInstruction()
        break

      case 'Identifier':
        if (this.isAFunction(node.callee.name)) {
          const stub = this.functionTable.get(node.callee.name)
          if (stub === undefined) throw 'FUNCTION_STUB_NOT_FOUND'
          this.appendPushStackFrameInstruction(this.createVariableArgument(targetOfCallArguments))
          this.appendPushInstruction(this.createAddrStubArgument(stub))
          this.appendJmpInstruction()
          // The above code must satisfy opcode length = 10
          break
        }
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
      switch (declaration.id.type) {
        case 'Identifier':
          if (this.isVariableInitialized(declaration.id.name)) {
            this.translateVariableAssignment(declaration.id, declaration.init)
            break
          }
          const target = this.context.incr()

          this.appendStoreInstruction([
            this.createNumberArgument(target),
            this.translateExpression(declaration.init)
          ])

          this.initializeVariable(declaration.id.name, target)
          break
        default:
          throw `UNHANDLED_VARIABLE_DECL_ID ${declaration.id.type}`
      }
    })
  }

  private translateVariableAssignment(
    node: babel.types.LVal | babel.types.OptionalMemberExpression,
    value: babel.types.Expression | null | undefined
  ) {
    switch (node.type) {
      case 'Identifier':
        if (!this.isVariableInitialized(node.name)) {
          throw `VARIABLE_NOT_DEFINED ${node.name}`
        }

        const reg = this.context.get(node.name)
        if (reg === undefined) {
          throw 'UNHANDLED'
        }

        this.appendStoreInstruction([
          this.createNumberArgument(reg),
          this.translateExpression(value)
        ])
        break

      case 'MemberExpression':
        this.pushMemberExpressionOntoStack(node)
        this.appendSetPropertyInstruction(this.translateExpression(value))
        break

      default:
        throw `UNHANDLED_VARIABLE_ASSIGNMENT ${node.type}`
    }
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
    node.params.forEach((param, index) => {
      switch (param.type) {
        case 'Identifier':
          const target = this.context.incr()
          this.initializeVariable(param.name, target)

          this.appendStoreInstruction([
            this.createNumberArgument(target),
            this.createParameterArgument(index)
          ])
          break
        default:
          console.error(param.type)
          throw 'UNHANDLED_FUNCTION_PARAM'
      }
    })

    this.buildIR(node.body.body)

    if (node.body.body.length === 0 || node.body.body[node.body.body.length - 1].type !== 'ReturnStatement') {
      this.appendPushInstruction(this.createUndefinedArgument())
      this.appendPopStackFrameInstruction()
    }

    this.context.pop()
  }

  private buildIR(statements: babel.types.Statement[], isMain = false) {
    const oepStub: Stub = {index: -1, type: StubType.OEP}

    if (isMain) {
      this.appendPushInstruction(this.createAddrStubArgument(oepStub))
      this.appendJmpInstruction()
    }

    statements.forEach(statement => {
      let stub: Stub = undefined

      if (isMain && !this.oepSet && statement.type !== 'FunctionDeclaration') {
        this.appendStubInstruction(this.createAddrStubArgument(oepStub))
        this.oepSet = true
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
              this.pushCallExpressionOntoStack(statement.expression)
              // Pop the return data of the calling from stack since it is not received.
              this.appendPopInstruction(this.createUndefinedArgument())
              break
            case 'AssignmentExpression':
              if (statement.expression.left.type === 'OptionalMemberExpression') {
                throw 'OPTIONAL_MEMBER_EXPRESSION_NOT_SUPPORTED'
              }
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

        case 'ReturnStatement':
          this.appendPushInstruction(this.translateExpression(statement.argument))
          this.appendPopStackFrameInstruction()
          break

        case 'ThrowStatement':
          this.appendPushInstruction(this.translateExpression(statement.argument))
          this.pushInstruction({
            opcode: Opcode.THROW,
            args: []
          })
          break

        case 'EmptyStatement':
          break

        default:
          throw `UNHANDLED_NODE ${statement.type}`
      }
    })
  }

  compile() {
    this.buildIR(this.ast.program.body, true)
    if (!this.oepSet) {
      console.log(chalk.yellow('The program does not have an valid entry point, the output will be blank!'))
      return {
        instructions: [],
        inheritsContext: true
      }
    }
    return this.ir
  }
}
