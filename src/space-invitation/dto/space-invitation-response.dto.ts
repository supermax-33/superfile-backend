import { InvitationStatus } from '@prisma/client';

export type SpaceInvitationInviter = {
  id: string;
  email: string;
  displayName: string | null;
};

export type SpaceInvitationSpace = {
  id: string;
  name: string;
};

export class SpaceInvitationResponseDto {
  readonly id: string;
  readonly space: SpaceInvitationSpace;
  readonly email: string;
  readonly status: InvitationStatus;
  readonly invitedBy: SpaceInvitationInviter;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(data: {
    id: string;
    space: SpaceInvitationSpace;
    email: string;
    status: InvitationStatus;
    invitedBy: SpaceInvitationInviter;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.space = data.space;
    this.email = data.email;
    this.status = data.status;
    this.invitedBy = data.invitedBy;
    this.expiresAt = data.expiresAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
