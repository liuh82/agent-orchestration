import { useMemo } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { radius } from '@/styles/tokens/radius';
import { typography } from '@/styles/tokens/typography';

const Wrapper = styled.div`
  .ant-form-item-label > label {
    color: ${colors.text.primary} !important;
    font-size: ${typography.fontSize.base} !important;
  }

  .rjsf > div > fieldset > div > .form-group {
    margin-bottom: ${spacing[4]};
  }

  input, select, textarea {
    font-size: ${typography.fontSize.base} !important;
  }

  .form-group {
    margin-bottom: ${spacing[4]};
  }

  label {
    color: ${colors.text.primary};
    font-size: ${typography.fontSize.base};
  }

  .form-control {
    border: 1px solid ${colors.border.DEFAULT};
    border-radius: ${radius.md};
    padding: ${spacing[2]} ${spacing[3]};
    font-size: ${typography.fontSize.base};
    background: #ffffff;
    color: ${colors.text.primary};

    &:focus {
      border-color: ${colors.border.focus};
      outline: none;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
    }
  }

  select.form-control {
    appearance: auto;
  }

  textarea.form-control {
    min-height: 80px;
    resize: vertical;
    font-family: ${typography.fontFamily.mono};
  }

  .invalid-feedback,
  .text-danger {
    color: ${colors.text.error};
    font-size: ${typography.fontSize.sm};
  }

  .help-block {
    color: ${colors.text.secondary};
    font-size: ${typography.fontSize.sm};
  }

  .field-description {
    color: ${colors.text.secondary};
    font-size: ${typography.fontSize.sm};
  }
`;

interface SchemaFormProps {
  schema: Record<string, unknown>;
  formData?: Record<string, unknown>;
  onChange?: (data: Record<string, unknown>) => void;
  readonly?: boolean;
  liveValidate?: boolean;
}

export const SchemaForm = ({
  schema,
  formData,
  onChange,
  readonly = false,
  liveValidate = true,
}: SchemaFormProps) => {
  const uiSchema = useMemo(() => {
    if (readonly) {
      return { 'ui:readonly': true, 'ui:disabled': true };
    }
    return {};
  }, [readonly]);

  if (!schema || Object.keys(schema).length === 0) {
    return null;
  }

  return (
    <Wrapper>
      <Form
        schema={schema as any}
        formData={formData}
        validator={validator}
        uiSchema={uiSchema}
        onChange={({ formData: data }) => {
          if (onChange && data) {
            onChange(data as Record<string, unknown>);
          }
        }}
        liveValidate={liveValidate}
        noHtml5Validate
      />
    </Wrapper>
  );
};
