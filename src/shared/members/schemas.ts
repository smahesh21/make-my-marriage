import { z } from "zod";

export const memberRoleSchema = z.enum(["ADMIN", "MANAGER"]);

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  role: memberRoleSchema,
});

export const updateMemberRoleSchema = z.object({
  role: memberRoleSchema,
});

export type MemberRole = z.infer<typeof memberRoleSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
