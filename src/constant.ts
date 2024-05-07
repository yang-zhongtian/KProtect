export const enum Header {
    LOAD_STRING = 100,
    LOAD_NUMBER,
    POP_STACK,
    FETCH_VARIABLE,
    FETCH_DEPENDENCY,
    LOAD_UNDEFINED,
    LOAD_ARRAY,
    LOAD_OBJECT,
    DYN_ADDR,
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
    DELETE_PROPERTY,
    IN,
    INSTANCE_OF,
    TYPEOF,
    APPLY,
    EQUAL,
    NOT_EQUAL,
    LESS_THAN,
    GREATER_THAN,
    JMP,
    JZ,
    ADDR_STUB,
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
    VOID,
    THROW,
    DELETE,
    PUSH_STACK_FRAME,
    POP_STACK_FRAME,
}
