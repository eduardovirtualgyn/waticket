import { messages as portugueseMessages } from "./pt";
import { messages as englishMessages } from "./en";
import { messages as spanishMessages } from "./es";

const messages = {
	...portugueseMessages,
	"pt-BR": { ...portugueseMessages.pt },
	...englishMessages,
	...spanishMessages,
};

export { messages };
