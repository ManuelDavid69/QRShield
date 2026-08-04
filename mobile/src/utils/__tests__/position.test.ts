import { coarsenCoordinate } from "../position";

describe("coarsenCoordinate", () => {
  it("arrondit à 3 décimales, soit une centaine de mètres", () => {
    expect(coarsenCoordinate(45.76403)).toBe(45.764);
    expect(coarsenCoordinate(4.83569)).toBe(4.836);
    expect(coarsenCoordinate(-0.12777)).toBe(-0.128);
  });
});
