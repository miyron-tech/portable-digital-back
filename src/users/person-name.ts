/**
 * Имя и фамилия из одного поля `name`.
 *
 * Платёжному провайдеру нужны обе части раздельно: WemoPay собирает из них
 * имя держателя карты, и без фамилии отклоняет платёж целиком
 * (`customer.lastName must not be null`). Фамилией считается всё после
 * первого слова: «Mary Ann Smith» даёт «Mary» и «Ann Smith».
 */
export function splitPersonName(name: string | null | undefined): {
  firstName: string;
  lastName: string | null;
} {
  const [firstName = '', ...rest] = (name ?? '').trim().split(/\s+/);
  const lastName = rest.join(' ');
  return { firstName, lastName: lastName || null };
}
