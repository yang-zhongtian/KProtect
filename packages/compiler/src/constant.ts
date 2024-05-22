export const enum Header {
  LOAD_STRING = 100,
  LOAD_NUMBER,
  POP_STACK,
  FETCH_VARIABLE,
  FETCH_DEPENDENCY,
  FETCH_PARAMETER,
  LOAD_UNDEFINED,
  LOAD_OBJECT,

  // Dynamic address, used for jump
  // if it is used in ADDR_STUB instruction: the address of the stub(differentiated by its index (value)) is determined
  //                                         by the index of the stub in the bytecode and stored in the lookup table
  // if it is used in Other instruction: the address is determined by looking up the value in the lookup table
  // if you can not completely understand this, please check file 'assembler.ts'
  DYN_ADDR,
}

export const enum Opcode {
  ADD,
  SUB,
  MUL,
  DIV,
  MOD,
  NOT,
  POS,
  NEG,
  STORE, // Store the value in the stack to the variable
  GET_PROPERTY,
  SET_PROPERTY,
  EXISTS,
  DELETE_PROPERTY,
  IN,
  INSTANCE_OF,
  TYPEOF,
  APPLY,
  EQUAL,
  LESS_THAN,
  GREATER_THAN,
  JMP,
  JZ,
  ADDR_STUB,
  BITWISE_AND,
  BITWISE_OR,
  BITWISE_XOR,
  BITWISE_LEFT_SHIFT,
  BITWISE_RIGHT_SHIFT,
  BITWISE_UNSIGNED_RIGHT_SHIFT,
  BITWISE_NOT,
  PUSH,
  POP,
  INIT_CONSTRUCTOR,
  BUILD_ARRAY,
  VOID,
  THROW,
  DELETE,
  PUSH_STACK_FRAME,
  POP_STACK_FRAME,
}
