import { extractMentionUsernames } from './mentions';

describe('extractMentionUsernames', () => {
  it('reconhece o @usuário no começo e depois de espaço ou pontuação', () => {
    expect(
      extractMentionUsernames('@ana oi, (@bruno.lima)! e @carla_dias.'),
    ).toEqual(['ana', 'bruno.lima', 'carla_dias']);
  });

  it('não reconhece o @ de um e-mail', () => {
    expect(extractMentionUsernames('escreve para ana@empresa.com')).toEqual([]);
  });

  it('trata maiúsculas como minúsculas e não repete', () => {
    expect(extractMentionUsernames('@Ana e @ana, de novo @ANA')).toEqual([
      'ana',
    ]);
  });

  it('ignora o que não tem o formato do @usuário', () => {
    expect(extractMentionUsernames('@ sozinho, @a curto e @-traço')).toEqual(
      [],
    );
  });
});
