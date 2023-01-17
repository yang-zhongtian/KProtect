export const enum Header {
    LOAD_STRING,
    LOAD_NUMBER,
    POP_STACK,
    FETCH_VARIABLE,
    FETCH_DEPENDENCY,
    LOAD_UNDEFINED,
    LOAD_ARRAY,
    LOAD_OBJECT,
}

export const enum Opcode {
    ADD,
    SUB,
    MUL,
    DIV,
    MOD,
    NEG,
    STORE,
    GET_PROPERTY,
    SET_PROPERTY,
    EXISTS,
    DELETE,
    IN,
    INSTANCE_OF,
    TYPEOF,
    CALL,
    EQUAL,
    NOT_EQUAL,
    LESS_THAN,
    LESS_THAN_EQUAL,
    STRICT_EQUAL,
    STRICT_NOT_EQUAL,
    GREATER_THAN,
    GREATER_THAN_EQUAL,
    JMP,
    JMP_IF_ELSE,
    JMP_NO_TRACEBACK,
    LOOP,
    AND,
    OR,
    BITWISE_AND,
    BITWISE_OR,
    BITWISE_XOR,
    BITWISE_LEFT_SHIFT,
    BITWISE_RIGHT_SHIFT,
    BITWISE_UNSIGNED_RIGHT_SHIFT,
    PUSH,
    POP,
    INIT_CONSTRUCTOR,
    INIT_ARRAY,
    INIT_OBJECT,
    EXIT,
    EXIT_IF,
    VOID,
    THROW,
    APPLY,
    CALL_MEMBER_EXPRESSION,
}
