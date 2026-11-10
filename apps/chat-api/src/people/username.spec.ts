import {
  USERNAME_PATTERN,
  assignUsernames,
  usernameBase,
  withSuffix,
} from './username';

describe('@usuário derivado do e-mail', () => {
  it.each([
    ['ana@empresa.com', 'ana'],
    ['Luiz.Carlos@empresa.com', 'luiz.carlos'],
    ['joão.ninguém@empresa.com', 'joao.ninguem'],
    ['ana+vendas@empresa.com', 'anavendas'],
    ['.ana_-@empresa.com', 'ana'],
    ['x@empresa.com', 'pessoa'],
    ['+@empresa.com', 'pessoa'],
    [
      'um-nome-muito-comprido-para-caber-inteiro@empresa.com',
      'um-nome-muito-comprido-para-ca',
    ],
    [
      'nome-comprido-com-hifen-na-posicao-30@x.com',
      'nome-comprido-com-hifen-na-pos',
    ],
    [
      'abcdefghijklmnopqrstuvwxyzabc-def@x.com',
      'abcdefghijklmnopqrstuvwxyzabc',
    ],
  ])('usernameBase deriva %s', (email, expected) => {
    const base = usernameBase(email);
    expect(base).toBe(expected);
    expect(base).toMatch(USERNAME_PATTERN);
  });

  it('withSuffix corta a base para caber o sufixo', () => {
    expect(withSuffix('ana', 1)).toBe('ana');
    expect(withSuffix('ana', 2)).toBe('ana2');
    expect(withSuffix('um-nome-muito-comprido-para-ca', 2)).toBe(
      'um-nome-muito-comprido-para-c2',
    );
    // O corte não deixa a base terminar em `-` antes do número.
    expect(withSuffix('um-nome-muito-comprido-para-ca', 12)).toBe(
      'um-nome-muito-comprido-para12',
    );
    expect(withSuffix('abcdefghijklmnopqrstuvwxyzab-c', 10)).toBe(
      'abcdefghijklmnopqrstuvwxyzab10',
    );
  });

  it('assignUsernames dá sufixo pela ordem de criação', () => {
    expect(
      assignUsernames(['ana@a.com', 'bruno@a.com', 'ana@b.com', 'Ana@c.com']),
    ).toEqual(['ana', 'bruno', 'ana2', 'ana3']);
  });

  it('assignUsernames pula um @usuário que já existe na lista', () => {
    expect(assignUsernames(['ana2@a.com', 'ana@a.com', 'ana@b.com'])).toEqual([
      'ana2',
      'ana',
      'ana3',
    ]);
  });

  it('assignUsernames usa pessoa para o que sobra curto', () => {
    expect(assignUsernames(['x@a.com', 'pessoa@a.com', 'y@a.com'])).toEqual([
      'pessoa',
      'pessoa2',
      'pessoa3',
    ]);
  });

  it('o formato recusa ponta sem letra ou número, maiúscula e tamanho fora do limite', () => {
    for (const invalid of [
      'a',
      'ana.',
      '-ana',
      'Ana',
      'joão',
      'a'.repeat(31),
    ]) {
      expect(invalid).not.toMatch(USERNAME_PATTERN);
    }
    for (const valid of ['ab', 'luiz.carlos', 'a_b-c', 'a'.repeat(30)]) {
      expect(valid).toMatch(USERNAME_PATTERN);
    }
  });
});
