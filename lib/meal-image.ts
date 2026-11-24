
export type MealImageMatch = {
  src: string;
  alt: string;
};

const MEAL_IMAGE_MATCHES: Array<{
  pattern: RegExp;
  src: string;
  alt: string;
}> = [
  {
    pattern: /^grilled chicken,\s*rice and vegetables\.?$/i,
    src: "/images/grilled-chicken-rice.jpg",
    alt: "Illustrative plate of grilled chicken, rice and vegetables",
  },
  {
    pattern: /^rice and beef stew\.?$/i,
    src: "/images/rice-beef-stew.jpg",
    alt: "Illustrative plate of rice and beef stew",
  },
  {
    pattern: /^roasted chicken with potatoes and salad\.?$/i,
    src: "/images/roasted-chicken-salad.jpg",
    alt: "Illustrative plate of roasted chicken, potatoes and salad",
  },
  {
    pattern: /^sadza and braaied meat\.?$/i,
    src: "/images/sadza-braaied-meat.jpg",
    alt: "Illustrative plate of sadza and braaied meat",
  },
  {
    pattern: /^sadza,\s*beef stew and muriwo\.?$/i,
    src: "/images/sadza-beef-stew.jpg",
    alt: "Illustrative plate of sadza, beef stew and leafy vegetables",
  },
  {
    pattern: /^sadza and pork bones\.?$/i,
    src: "/images/sadza-pork-bones.jpg",
    alt: "Illustrative plate of sadza and pork bones",
  },
];

export function getMealImage(name: string): MealImageMatch | null {
  const normalizedName = name.trim().replace(/\s+/g, " ");

  if (!normalizedName) return null;

  return (
    MEAL_IMAGE_MATCHES.find((image) =>
      image.pattern.test(normalizedName),
    ) ?? null
  );
}
