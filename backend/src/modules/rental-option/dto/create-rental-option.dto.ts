export class CreateRentalOptionDto {
  name: string;
  description?: string;
  base_price?: number;
  price_per_person?: number;
  active?: boolean;
}
