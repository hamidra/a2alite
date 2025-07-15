import {
  StateGraph,
  END,
  START,
  Annotation,
  interrupt,
  Command,
  CompiledStateGraph,
} from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

// Define the state structure for the job order form using LangGraph Annotation
const JobOrderFormState = Annotation.Root({
  name: Annotation<string | undefined>,
  dob: Annotation<string | undefined>,
  inquiry: Annotation<string | undefined>,
  messages: Annotation<BaseMessage[]>,
  currentState: Annotation<string>,
});

type JobOrderFormStateType = typeof JobOrderFormState.State;

export function createJobOrderFormAgent() {
  const workflow = new StateGraph(JobOrderFormState);
  const checkpointer = new MemorySaver();

  // Define nodes for each step
  return workflow
    .addNode("collect_name", collectName)
    .addNode("collect_dob", collectDOB)
    .addNode("collect_inquiry", collectInquiry)
    .addNode("complete_form", completeForm)
    .addEdge(START, "collect_name")
    .addEdge("collect_name", "collect_dob")
    .addEdge("collect_dob", "collect_inquiry")
    .addEdge("collect_inquiry", "complete_form")
    .addEdge("complete_form", END)
    .compile({ checkpointer });
}

async function collectName(
  state: JobOrderFormStateType
): Promise<Partial<JobOrderFormStateType>> {
  let name = interrupt(
    "Hello! I'll help you fill out a job order form. Let's start with your full name."
  );
  while (!validateName(name)) {
    console.log("name is invalid", name);
    name = interrupt(
      "Please provide a valid name (at least 2 characters, letters and spaces only). "
    );
  }
  return {
    name,
  };
}

async function collectDOB(
  state: JobOrderFormStateType
): Promise<Partial<JobOrderFormStateType>> {
  let dob = interrupt(
    `Thank you, ${state.name}! Now, please provide your date of birth (MM/DD/YYYY format).`
  );
  while (!validateDOB(dob)) {
    dob = interrupt(
      "Please provide a valid date of birth in MM/DD/YYYY format."
    );
  }
  return {
    dob,
  };
}

async function collectInquiry(
  state: JobOrderFormStateType
): Promise<Partial<JobOrderFormStateType>> {
  let inquiry = interrupt(
    "Great! Finally, please describe your current inquiry or the type of work you're looking for."
  );
  while (!validateInquiry(inquiry)) {
    inquiry = interrupt(
      "Please provide a more detailed inquiry (at least 10 characters)."
    );
  }
  return {
    inquiry,
  };
}

async function completeForm(
  state: JobOrderFormStateType
): Promise<Partial<JobOrderFormStateType>> {
  return {
    messages: [
      new AIMessage(
        "Great! Finally, please describe your current inquiry or the type of work you're looking for."
      ),
    ],
  };
}

function validateName(name: string): boolean {
  return name.trim().length >= 2;
}

function validateDOB(dob: string): boolean {
  const dobRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
  if (!dobRegex.test(dob)) return false;

  const date = new Date(dob);
  const now = new Date();
  return date < now && date.getFullYear() > 1900;
}

function validateInquiry(inquiry: string): boolean {
  return inquiry.trim().length >= 10;
}

/*
const agent = createJobOrderFormAgent();
const config = {
  configurable: { thread_id: "1" },
};

const r = await agent.invoke(
  { messages: [new HumanMessage("Hello!")] },
  config
);

const result = await agent.invoke(
  new Command({
    resume: "h",
  }),
  config
);
const state = await agent.getState(config);
console.log("result", result);
console.log("state", state);
console.log("values", state.values);
console.log("tasks", state.tasks);
console.log("interrupts", state.tasks[0].interrupts[0]);
*/
