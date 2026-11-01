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
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Campaign from "./Campaign";
import Contact from "./Contact";

@Table
class CampaignShipping extends Model<CampaignShipping> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Campaign)
  @Column
  campaignId: number;

  @BelongsTo(() => Campaign)
  campaign: Campaign;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @AllowNull(false)
  @Column
  number: string;

  @Column
  name: string;

  @Column(DataType.TEXT)
  message: string;

  @Default("PENDING")
  @Column
  status: string;

  @Column
  deliveredAt: Date;

  @Column(DataType.TEXT)
  error: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CampaignShipping;
