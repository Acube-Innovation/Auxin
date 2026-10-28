import React, { useState } from "react";
import CreatableSelect from "react-select/creatable";

// Picker for the New Voyage form: type to search the list; a name that is not in it can be added
// on the spot ("+ Add “…” as new charterer"). onCreate(name) returns the new option, or null.
function PickOrAdd({ value, onChange, onCreate, isMulti = false, what, ...rest }) {
  const [adding, setAdding] = useState(false);
  const create = async (name) => {
    setAdding(true);
    try {
      const opt = await onCreate(name.trim());
      if (opt) onChange(isMulti ? [...(value || []), opt] : opt);
    } finally {
      setAdding(false);
    }
  };
  return (
    <CreatableSelect
      {...rest}
      isMulti={isMulti}
      value={value}
      onChange={onChange}
      onCreateOption={create}
      isDisabled={adding || rest.isDisabled}
      isLoading={adding}
      formatCreateLabel={(text) => `+ Add “${text}” as new ${what}`}
      isValidNewOption={(text, _value, options) => {
        const t = text.trim().toLowerCase();
        return Boolean(t) && !options.some((o) => [o.label, o.name].some((l) => l && l.toLowerCase() === t));
      }}
    />
  );
}

export default PickOrAdd;
