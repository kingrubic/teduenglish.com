import {describe,expect,it} from "vitest"; import {canManage,ownsStudentRecord} from "./permissions";
const teacher={id:"t",tenantId:"x",email:"t@x",name:"T",role:"MOD" as const}; const student={id:"s",tenantId:"x",email:"s@x",name:"S",role:"USER" as const};
describe("permissions",()=>{it("allows teachers to manage",()=>expect(canManage(teacher)).toBe(true));it("denies students management",()=>expect(canManage(student)).toBe(false));it("keeps student records isolated",()=>{expect(ownsStudentRecord(student,"s")).toBe(true);expect(ownsStudentRecord(student,"other")).toBe(false)})});
