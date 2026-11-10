import { InvalidProfileError } from './invalid-profile.error';
import { namesOutsideRuleMessage, parseName } from './profile-values';

describe('regra do nome', () => {
  it('apara as pontas', () => {
    expect(parseName('  Ana Souza ')).toBe('Ana Souza');
  });

  it('aceita 80 caracteres, contados em code points', () => {
    expect(parseName('😀'.repeat(80))).toBe('😀'.repeat(80));
  });

  it.each([
    ['vazio', '   '],
    ['com quebra de linha', 'Ana\nSouza'],
    ['com 81 caracteres', 'a'.repeat(81)],
  ])('recusa o nome %s', (_case, name) => {
    expect(() => parseName(name)).toThrow(InvalidProfileError);
  });
});

describe('recusa da migração do nome', () => {
  it('lista o id e o e-mail de quem está fora da regra', () => {
    const message = namesOutsideRuleMessage([
      { id: '2', email: 'bia@x.dev' },
      { id: '3', email: 'caio@x.dev' },
    ]);

    expect(message).toContain('2 <bia@x.dev>');
    expect(message).toContain('3 <caio@x.dev>');
  });
});
