import { InvalidProfileError } from './invalid-profile.error';
import { namesOutsideRule, parseName } from './profile-values';

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

describe('nomes fora da regra, para a migração', () => {
  it('não acusa nada quando todos cabem', () => {
    expect(
      namesOutsideRule([{ id: '1', email: 'ana@x.dev', name: 'Ana Souza' }]),
    ).toBeNull();
  });

  it('acusa o id e o e-mail de quem passa da regra', () => {
    const message = namesOutsideRule([
      { id: '1', email: 'ana@x.dev', name: 'Ana Souza' },
      { id: '2', email: 'bia@x.dev', name: 'b'.repeat(81) },
      { id: '3', email: 'caio@x.dev', name: ' Caio' },
    ]);

    expect(message).toContain('2 <bia@x.dev>');
    expect(message).toContain('3 <caio@x.dev>');
    expect(message).not.toContain('ana@x.dev');
  });
});
