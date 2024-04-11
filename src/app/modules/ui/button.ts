import { ChangeCallback } from "@utils/callbacks";
import { Element, div } from "@utils/ui/ui";
import { Button } from "app/apis/ui";

export class ButtonImpl implements Button {
  private root: Element;

  constructor(handler: ChangeCallback<void>) {
    this.root = div('button')
      .addEvent('click', _ => handler());
  }

  setContetnt(elem: Element): this {
    this.root.elem().replaceChildren(elem.elem());
    return this;
  }

  asWidget(): Element {
    return this.root;
  }
}