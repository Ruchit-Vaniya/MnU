// Hardcoded dummy data for the demo QR menu — MnU's real menu/ordering
// backend doesn't exist yet (that's a later day's task), so this page is a
// visual preview only, not wired to any API.

export interface DummyMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  isVeg: boolean;
  categoryId: string;
}

export interface DummyCategory {
  id: string;
  name: string;
}

export const dummyRestaurant = {
  name: 'Demo Restaurant',
  tableNumber: '04',
  isOpen: true,
};

export const dummyCategories: DummyCategory[] = [
  { id: 'starters', name: 'Starters' },
  { id: 'mains', name: 'Mains' },
  { id: 'drinks', name: 'Drinks' },
];

export const dummyMenuItems: DummyMenuItem[] = [
  { id: '1', name: 'Tomato Basil Soup', description: 'Slow-roasted tomato, fresh basil, cream', price: 220, isVeg: true, categoryId: 'starters' },
  { id: '2', name: 'Grilled Paneer Tikka', description: 'Char-grilled, smoked pepper marinade', price: 340, isVeg: true, categoryId: 'starters' },
  { id: '3', name: 'Chicken Seekh Kebab', description: 'Minced chicken, house spice blend', price: 380, isVeg: false, categoryId: 'starters' },
  { id: '4', name: 'Margherita Pizza', description: 'San Marzano tomato, fresh mozzarella, basil', price: 390, isVeg: true, categoryId: 'mains' },
  { id: '5', name: 'Butter Chicken', description: 'Slow-cooked tomato gravy, cream, butter', price: 460, isVeg: false, categoryId: 'mains' },
  { id: '6', name: 'Dal Makhani', description: 'Black lentils, slow-simmered overnight', price: 300, isVeg: true, categoryId: 'mains' },
  { id: '7', name: 'Mango Lassi', description: 'Fresh mango, yogurt, a hint of cardamom', price: 150, isVeg: true, categoryId: 'drinks' },
  { id: '8', name: 'Masala Chai', description: 'Spiced tea, brewed fresh', price: 90, isVeg: true, categoryId: 'drinks' },
];
