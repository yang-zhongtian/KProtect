import * as babel from '@babel/core';
import { parse } from '@babel/parser';
import { Dependency } from './constant.js';
export default class Compiler {
    constructor(source) {
        this.ast = parse(source);
        this.contexts = [{
                variables: new Map(),
                counter: 0
            }];
        this.dependencies = Dependency.map(this.getObjectName);
        const block = {
            instructions: [],
            inheritsContext: true,
        };
        this.blocks = [block];
        this.il = { 'main': block };
    }
    getObjectName(object) {
        if (typeof object === 'function') {
            return object.name ?? object.constructor.name;
        }
        else if (typeof object === 'object') {
            return object.toString().match(/^\[object\s(?<s>.*)]$/)?.groups?.s;
        }
        else if (typeof object === 'number') {
            return object.toString();
        }
        return String(object);
    }
    isVariableInitialized(name) {
        return this.contexts[0].variables.has(name);
    }
    initializeVariable(name, dst) {
        this.contexts[0].variables.set(name, dst);
    }
    isADependency(name) {
        return this.dependencies.includes(name);
    }
    getDependencyPointer(name) {
        return this.dependencies.indexOf(name);
    }
    pushInstruction(instruction) {
        this.blocks[0].instructions.push(instruction);
    }
    createNumberArgument(dst) {
        return {
            type: 1 /* Header.LOAD_NUMBER */,
            value: dst
        };
    }
    createArrayArgument() {
        return {
            type: 6 /* Header.LOAD_ARRAY */,
            value: null
        };
    }
    createUndefinedArgument() {
        return {
            type: 5 /* Header.LOAD_UNDEFINED */,
            value: null
        };
    }
    createDependencyArgument(pointer) {
        return {
            type: 4 /* Header.FETCH_DEPENDENCY */,
            value: pointer
        };
    }
    createStringArgument(value) {
        return {
            type: 0 /* Header.LOAD_STRING */,
            value: value
        };
    }
    createVariableArgument(dst) {
        return {
            type: 3 /* Header.FETCH_VARIABLE */,
            value: dst
        };
    }
    translateUnaryExpression(node) {
        this.appendPushInstruction(this.translateExpression(node.argument));
        switch (node.operator) {
            case 'typeof':
                this.appendTypeofInstruction();
                break;
            case '!':
                this.appendNotInstruction();
                break;
            default:
                console.error(node.operator);
                throw 'UNSUPPORTED_UNARY_TYPE';
        }
    }
    translateExpression(node) {
        if (node === undefined || node === null) {
            return {
                type: 5 /* Header.LOAD_UNDEFINED */,
                value: null
            };
        }
        let target;
        switch (node.type) {
            case 'UnaryExpression':
                this.translateUnaryExpression(node);
                target = this.contexts[0].counter++;
                this.appendPopInstruction(this.createNumberArgument(target));
                return this.createVariableArgument(target);
            case 'CallExpression':
                this.pushCallExpressionOntoStack(node);
                target = this.contexts[0].counter++;
                this.appendPopInstruction(this.createNumberArgument(target));
                return this.createVariableArgument(target);
            case 'MemberExpression':
                this.pushMemberExpressionOntoStack(node);
                this.appendGetPropertyInstruction();
                target = this.contexts[0].counter++;
                this.appendPopInstruction(this.createNumberArgument(target));
                return this.createVariableArgument(target);
            case 'BinaryExpression':
                this.translateBinaryExpression(node);
                target = this.contexts[0].counter++;
                this.appendPopInstruction(this.createNumberArgument(target));
                return this.createVariableArgument(target);
            case 'StringLiteral':
                return this.createStringArgument(node.value);
            case 'Identifier':
                if (this.isADependency(node.name)) {
                    return this.createDependencyArgument(this.getDependencyPointer(node.name));
                }
                const reg = this.contexts[0].variables.get(node.name);
                if (reg === undefined)
                    throw 'UNKNOWN_SOURCE_VARIABLE';
                return this.createVariableArgument(reg);
            case 'NumericLiteral':
                return this.createNumberArgument(node.value);
            default:
                console.error(node.type);
                throw 'UNHANDLED_VALUE';
        }
    }
    appendNotInstruction() {
        this.pushInstruction({
            opcode: 26 /* Opcode.NOT */,
            args: []
        });
    }
    appendTypeofInstruction() {
        this.pushInstruction({
            opcode: 13 /* Opcode.TYPEOF */,
            args: []
        });
    }
    appendStoreInstruction(args) {
        this.pushInstruction({
            opcode: 6 /* Opcode.STORE */,
            args: args
        });
    }
    appendGetPropertyInstruction() {
        this.pushInstruction({
            opcode: 7 /* Opcode.GET_PROPERTY */,
            args: []
        });
    }
    appendCallMemberExpression() {
        this.pushInstruction({
            opcode: 42 /* Opcode.CALL_MEMBER_EXPRESSION */,
            args: []
        });
    }
    appendPushInstruction(arg) {
        this.pushInstruction({
            opcode: 33 /* Opcode.PUSH */,
            args: [arg]
        });
    }
    appendPopInstruction(arg) {
        this.pushInstruction({
            opcode: 34 /* Opcode.POP */,
            args: [arg]
        });
    }
    appendCallInstruction() {
        this.pushInstruction({
            opcode: 14 /* Opcode.CALL */,
            args: []
        });
    }
    appendApplyInstruction() {
        this.pushInstruction({
            opcode: 41 /* Opcode.APPLY */,
            args: []
        });
    }
    appendInitArrayInstruction() {
        this.pushInstruction({
            opcode: 36 /* Opcode.INIT_ARRAY */,
            args: []
        });
    }
    appendJmpIfElseInstruction(arg$1, arg$2) {
        this.pushInstruction({
            opcode: 23 /* Opcode.JMP_IF_ELSE */,
            args: [arg$1, arg$2]
        });
    }
    declareArrVariable() {
        const target = this.contexts[0].counter++;
        this.appendStoreInstruction([
            this.createNumberArgument(target),
            this.createArrayArgument()
        ]);
        return target;
    }
    declareArrVariableWithValue(argument) {
        this.appendPushInstruction(this.translateExpression(argument));
        this.appendInitArrayInstruction();
        const target = this.contexts[0].counter++;
        this.appendPopInstruction(this.createNumberArgument(target));
        return target;
    }
    /**
     * 处理二元运算符
     */
    translateBinaryExpression(node) {
        if (node.left.type === 'PrivateName')
            throw 'UNHANDLED_PRIVATE_NAME';
        const left = this.translateExpression(node.left);
        const right = this.translateExpression(node.right);
        this.appendPushInstruction(left);
        this.appendPushInstruction(right);
        switch (node.operator) {
            case '==':
                this.pushInstruction({
                    opcode: 15 /* Opcode.EQUAL */,
                    args: []
                });
                break;
            case '===':
                this.pushInstruction({
                    opcode: 19 /* Opcode.STRICT_EQUAL */,
                    args: []
                });
                break;
            case '!=':
                this.pushInstruction({
                    opcode: 16 /* Opcode.NOT_EQUAL */,
                    args: []
                });
                break;
            case '!==':
                this.pushInstruction({
                    opcode: 20 /* Opcode.STRICT_NOT_EQUAL */,
                    args: []
                });
                break;
            case '+':
                this.pushInstruction({
                    opcode: 0 /* Opcode.ADD */,
                    args: []
                });
                break;
            case '-':
                this.pushInstruction({
                    opcode: 1 /* Opcode.SUB */,
                    args: []
                });
                break;
            case '*':
                this.pushInstruction({
                    opcode: 2 /* Opcode.MUL */,
                    args: []
                });
                break;
            case '/':
                this.pushInstruction({
                    opcode: 3 /* Opcode.DIV */,
                    args: []
                });
                break;
            case '%':
                this.pushInstruction({
                    opcode: 4 /* Opcode.MOD */,
                    args: []
                });
                break;
            case '<':
                this.pushInstruction({
                    opcode: 17 /* Opcode.LESS_THAN */,
                    args: []
                });
                break;
            case '<=':
                this.pushInstruction({
                    opcode: 18 /* Opcode.LESS_THAN_EQUAL */,
                    args: []
                });
                break;
            case '>':
                this.pushInstruction({
                    opcode: 21 /* Opcode.GREATER_THAN */,
                    args: []
                });
                break;
            case '>=':
                this.pushInstruction({
                    opcode: 22 /* Opcode.GREATER_THAN_EQUAL */,
                    args: []
                });
                break;
            default:
                throw 'UNHANDLED_OPERATOR_BINARY_EXPRESSION';
        }
    }
    pushMemberExpressionOntoStack(node) {
        switch (node.object.type) {
            case 'Identifier':
                // 举例:
                // console.log("test") ->
                // var bb = console["log"]
                // bb("test")
                // 依赖命中
                if (this.isADependency(node.object.name)) {
                    const pointer = this.dependencies.indexOf(node.object.name);
                    this.appendPushInstruction(this.createDependencyArgument(pointer));
                }
                else {
                    console.error(node.object.name);
                    throw 'BASE_NOT_DEPENDENCY';
                }
                if (node.property.type !== 'Identifier')
                    throw 'UNSUPPORTED_PROPERTY_TYPE';
                break;
            case 'CallExpression':
                this.pushCallExpressionOntoStack(node.object);
                break;
            default:
                console.error(node.object);
                throw 'UNHANDLED_MEMBER_EXPRESSION_STATE';
        }
        if (node.property.type !== 'Identifier')
            throw 'UNHANDLED_PROPERTY_TYPE';
        this.appendPushInstruction(this.createStringArgument(node.property.name));
    }
    // We translate call arguments by constructing an array of all elements
    // 1) Defining a new variable with empty array
    // 2) EXEC Push this variable reference onto stack
    // 3) EXEC Push "push" string onto stack
    // 4) EXEC Get_Property and pushes onto top of stack
    // 5) EXEC Push "argument"
    // 6) EXEC Call
    // returns a pointer to the arguments array
    pushCallArgumentsOntoStack(args) {
        // define argument array
        const argumentsArrayToCall = this.declareArrVariable();
        args.forEach(argument => {
            const initializedArrPointer = this.declareArrVariableWithValue(argument);
            // pushes a reference onto stack
            this.appendPushInstruction(this.createArrayArgument());
            this.appendPushInstruction(this.createStringArgument('push'));
            this.appendGetPropertyInstruction();
            this.appendPushInstruction(this.createVariableArgument(argumentsArrayToCall));
            this.appendPushInstruction(this.createVariableArgument(initializedArrPointer));
            this.appendApplyInstruction();
        });
        return argumentsArrayToCall;
    }
    pushCallExpressionOntoStack(node) {
        const targetOfCallArguments = this.pushCallArgumentsOntoStack(node.arguments);
        switch (node.callee.type) {
            case 'MemberExpression':
                this.pushMemberExpressionOntoStack(node.callee);
                this.appendPushInstruction(this.createVariableArgument(targetOfCallArguments));
                this.appendCallMemberExpression();
                break;
            case 'Identifier':
                this.appendPushInstruction(this.translateExpression(node.callee));
                this.appendPushInstruction(this.createVariableArgument(targetOfCallArguments));
                this.appendCallInstruction();
                break;
            default:
                console.error(node.callee.type);
                throw 'UNHANDLED_CALL_EXPRESSION_TYPE';
        }
    }
    translateWhileLoop(node) {
        console.error(node);
        throw 'WHILE_LOOP_UNSUPPORTED';
        // TODO 转译while
    }
    translateIfStatement(node) {
        let block = {
            instructions: [],
            inheritsContext: true,
        };
        let if_label = `if_${node.start}:${node.end}`;
        let else_label = `else_${node.start}:${node.end}`;
        // push the expression onto the stack
        this.appendPushInstruction(this.translateExpression(node.test));
        if (!node.alternate) {
            this.appendJmpIfElseInstruction(this.createStringArgument(if_label), this.createUndefinedArgument());
        }
        else {
            this.appendJmpIfElseInstruction(this.createStringArgument(if_label), this.createStringArgument(else_label));
        }
        this.il[if_label] = block;
        this.blocks.unshift(block);
        if (node.consequent.type === 'BlockStatement') {
            this.buildIL(node.consequent.body);
        }
        else {
            this.buildIL([node.consequent]);
        }
        this.blocks.shift();
        if (!node.alternate)
            return;
        block = {
            instructions: [],
            inheritsContext: true,
        };
        this.il[else_label] = block;
        this.blocks.unshift(block);
        if (node.alternate.type === 'BlockStatement') {
            this.buildIL(node.alternate.body);
        }
        else {
            this.buildIL([node.alternate]);
        }
        this.blocks.shift();
    }
    translateVariableDeclaration(node) {
        node.declarations.forEach(declaration => {
            if (declaration.id.type !== 'Identifier') {
                throw 'UNHANDLED_VARIABLE_DECL_ID';
            }
            let target = this.contexts[0].counter++;
            if (this.isVariableInitialized(declaration.id.name)) {
                const reg = this.contexts[0].variables.get(declaration.id.name);
                if (reg === undefined) {
                    throw 'UNHANDLED';
                }
                target = reg;
            }
            this.appendStoreInstruction([
                this.createNumberArgument(target),
                this.translateExpression(declaration.init),
            ]);
            this.initializeVariable(declaration.id.name, target);
        });
    }
    buildIL(statements) {
        statements.forEach(statement => {
            switch (statement.type) {
                case 'IfStatement':
                    this.translateIfStatement(statement);
                    break;
                case 'WhileStatement':
                    this.translateWhileLoop(statement);
                    break;
                case 'VariableDeclaration':
                    this.translateVariableDeclaration(statement);
                    break;
                case 'ExpressionStatement':
                    switch (statement.expression.type) {
                        case 'CallExpression':
                            this.pushCallExpressionOntoStack(statement.expression);
                            break;
                        case 'AssignmentExpression':
                            const declarator = babel.types.variableDeclarator(statement.expression.left, statement.expression.right);
                            const declaration = babel.types.variableDeclaration('var', [declarator]);
                            this.translateVariableDeclaration(declaration);
                            break;
                        default:
                            console.error(statement.expression.type);
                            throw 'UNHANDLED_EXPRESSION_STATEMENT';
                    }
                    break;
                default:
                    console.error(statement.type);
                    throw 'UNHANDLED_NODE';
            }
        });
    }
    compile() {
        this.buildIL(this.ast.program.body);
        return this.il;
    }
}
