import { errorMessage } from "../api";

function validationError(field: string) {
  return { detail: [{ loc: ["body", field], msg: "invalide" }] };
}

describe("errorMessage", () => {
  it("indique que le mot de passe est trop court", () => {
    expect(errorMessage(422, validationError("password"))).toBe(
      "Le mot de passe doit contenir au moins 10 caractères.",
    );
  });

  it("indique que l'e-mail est invalide", () => {
    expect(errorMessage(422, validationError("email"))).toBe("Cette adresse e-mail n'est pas valide.");
  });

  it("garde un message générique pour les autres champs", () => {
    expect(errorMessage(422, validationError("content"))).toBe("Vérifiez les informations saisies.");
  });

  it("reprend le message du serveur", () => {
    expect(errorMessage(409, { detail: "Un compte existe déjà avec cet email" })).toBe(
      "Un compte existe déjà avec cet email",
    );
  });

  it("reste lisible sans réponse exploitable", () => {
    expect(errorMessage(500, null)).toBe("Le serveur a renvoyé une erreur.");
  });
});
