import { describe, it, expect } from 'bun:test';
import { loginSchema, registerSchema, profileSchema } from '../src/lib/validation/auth.schema';

describe('Authentication Validation', () => {
  it('validates correct login credentials', () => {
    const valid = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects invalid email address', () => {
    const invalid = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates matching registration passwords', () => {
    const valid = registerSchema.safeParse({
      displayName: 'Kelvin Cole',
      username: 'kelvin_cole',
      email: 'kelvin@example.com',
      password: 'securePassword1',
      confirmPassword: 'securePassword1',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects mismatched registration passwords', () => {
    const invalid = registerSchema.safeParse({
      displayName: 'Kelvin Cole',
      username: 'kelvin_cole',
      email: 'kelvin@example.com',
      password: 'securePassword1',
      confirmPassword: 'differentPassword',
    });
    expect(invalid.success).toBe(false);
  });

  it('rejects username with invalid special characters', () => {
    const invalid = registerSchema.safeParse({
      displayName: 'Kelvin Cole',
      username: 'kelvin@!#$',
      email: 'kelvin@example.com',
      password: 'securePassword1',
      confirmPassword: 'securePassword1',
    });
    expect(invalid.success).toBe(false);
  });
});
