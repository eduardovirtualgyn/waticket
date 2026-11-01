import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  AllowNull,
  HasMany,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Whatsapp from "./Whatsapp";
import User from "./User";
import CampaignShipping from "./CampaignShipping";

@Table
class Campaign extends Model<Campaign> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  message: string;

  @Default("PENDING")
  @Column
  status: string; // PENDING, PROCESSING, PAUSED, COMPLETED, CANCELLED

  @Column
  scheduledAt: Date;

  @Column
  completedAt: Date;

  @Column
  mediaPath: string;

  @Column
  mediaName: string;

  @Default(20)
  @Column
  minDelay: number;

  @Default(45)
  @Column
  maxDelay: number;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @HasMany(() => CampaignShipping, { onDelete: "CASCADE" })
  shippings: CampaignShipping[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Campaign;
