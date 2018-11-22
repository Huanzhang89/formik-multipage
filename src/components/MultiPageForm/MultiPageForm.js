import React from 'react'
import PropTypes from 'prop-types'
import { Redirect } from 'react-router-dom'

import { Formik } from 'formik'
import R from 'ramda'
import Progress from 'Components/Progress'
import ModalError from 'Components/ModalError'

export default class MultiFormRoutes extends React.Component {
  static Page = ({ children, ...rest }) => {
    return children(rest)
  }

  static propTypes = {
    initialValues: PropTypes.object,
    submitText: PropTypes.string,
    renderSubmit: PropTypes.func,
    onSubmit: PropTypes.func.isRequired,
    sessionStorageKey: PropTypes.string,
    checkStorageReset: PropTypes.array,
    handleStorageReset: PropTypes.func,
    availableAdSlots: PropTypes.array,
    history: PropTypes.shape({
      push: PropTypes.func,
    }).isRequired,
    routes: PropTypes.array.isRequired,
    currentStep: PropTypes.number,
    children: PropTypes.node.isRequired,
    steps: PropTypes.array.isRequired,
  }

  static defaultProps = {
    initialValues: null,
    submitText: 'Submit',
    renderSubmit: undefined,
    sessionStorageKey: '',
    checkStorageReset: [],
    handleStorageReset: null,
    availableAdSlots: [],
    currentStep: 0,
  }

  constructor(props) {
    super(props)
    this.newValues = {}
    const cachedValues = sessionStorage.getItem(this.props.sessionStorageKey)
    const parsedValues = cachedValues ? JSON.parse(cachedValues) : null
    if (props.initialValues.price) {
      this.newValues = R.assoc('price', this.props.initialValues.price / 100)(
        this.props.initialValues
      )
    } else {
      this.newValues = this.props.initialValues
    }
    const stateValues = parsedValues || this.newValues

    this.state = {
      values: stateValues,
      validSteps: this.getValidSteps(props.steps, stateValues),
    }
  }

  getValidSteps = (steps, values) => {
    return steps
      .filter(({ fields }) => fields.every(field => !!values[field]))
      .map(step => step.id)
  }

  getInactiveSteps = (steps, valid) => {
    const lastValid = R.last(valid)
    const lastValidIndex = R.findIndex(step => step.id === lastValid, steps)
    return R.slice(lastValidIndex + 2, Infinity, steps).map(step => step.id)
  }

  next = values => {
    const validSteps = this.getValidSteps(this.props.steps, values)
    this.setState(
      () => ({
        values,
        validSteps,
      }),
      () => {
        this.props.history.push(
          this.props.routes[
            Math.min(this.props.currentStep + 1, this.props.children.length - 1)
          ]
        )
      }
    )
  }

  previous = () => {
    this.props.history.push(
      this.props.routes[Math.max(this.props.currentStep - 1, 0)]
    )
  }

  validate = values => {
    const activePage = React.Children.toArray(this.props.children)[
      this.props.currentStep
    ]
    return activePage.props.validate ? activePage.props.validate(values) : {}
  }

  handleSubmit = (values, bag) => {
    const {
      children,
      onSubmit,
      currentStep,
      sessionStorageKey,
      checkStorageReset,
      availableAdSlots,
      handleStorageReset,
    } = this.props
    const isLastPage = currentStep === React.Children.count(children) - 1
    if (isLastPage) {
      let newValues = {}
      if (values.price) {
        newValues = R.assoc('price', values.price * 100)(values)
      } else {
        newValues = values
      }
      sessionStorage.setItem(sessionStorageKey, '')
      return onSubmit(newValues, bag)
    }

    let newValues = values

    if (checkStorageReset.indexOf(Number(currentStep)) > -1) {
      const selectedSlot = availableAdSlots[0]
      if (handleStorageReset) {
        newValues = handleStorageReset(values, selectedSlot)
      }
    }

    sessionStorage.setItem(sessionStorageKey, JSON.stringify(newValues))
    this.next(newValues)
    bag.setTouched({})
    bag.setSubmitting(false)
    return void 0
  }

  render() {
    const {
      children,
      currentStep,
      submitText,
      renderSubmit,
      initialValues,
      steps,
    } = this.props
    const { values: stateValues, validSteps } = this.state

    const values = R.mergeWith(
      (stateValue, propsValue) =>
        propsValue && stateValue === '' ? propsValue : stateValue,
      stateValues,
      initialValues
    )
    const inactiveSteps = this.getInactiveSteps(steps, validSteps)
    const currentStepId = (steps[currentStep] || {}).id
    // path mismatch - send to start of process
    if (currentStep === -1 || inactiveSteps.includes(currentStepId)) {
      const availableSteps = steps
        .filter(step => !inactiveSteps.includes(step.id))
        .filter(step => !validSteps.includes(step.id))
      return <Redirect to={(availableSteps || steps)[0].url} />
    }
    const activePage = React.Children.toArray(children)[currentStep]
    const isLastPage = currentStep === React.Children.count(children) - 1
    if (!activePage) {
      return (
        <ModalError
          title="An unrecoverable error has occured"
          message="Please email the Sakaza team at info@sakaza.io"
        />
      )
    }
    return (
      <>
        {currentStepId && (
          <Progress
            current={currentStepId}
            valid={validSteps}
            inactive={inactiveSteps}
            options={steps}
          />
        )}
        <Formik
          initialValues={values}
          enableReinitialize={false}
          validate={this.validate}
          onSubmit={this.handleSubmit}
          validateOnChange
          validateOnBlur={false}
          render={({
            values,
            handleSubmit,
            isSubmitting,
            handleReset,
            setFieldValue,
            setFieldTouched,
            setSubmitting,
            errors,
            validateField,
            touched,
          }) => (
            <form className="form-default" onSubmit={handleSubmit}>
              {currentStep > 0 && (
                <button
                  type="button"
                  className="form-back-button"
                  onClick={this.previous}
                >
                  Back
                </button>
              )}
              {React.cloneElement(activePage, {
                formValues: values,
                errors,
                validateField,
                setFieldValue,
                setFieldTouched,
                isSubmitting,
                touched,
              })}
              <div className="buttons">
                {!isLastPage && (
                  <button type="submit">
                    {activePage.props.nextButtonLabel || 'Next'}
                  </button>
                )}
                {isLastPage &&
                  (renderSubmit ? (
                    renderSubmit({
                      isSubmitting,
                      setSubmitting,
                      values,
                    })
                  ) : (
                    <button type="submit" disabled={isSubmitting}>
                      {submitText}
                    </button>
                  ))}
              </div>
            </form>
          )}
        />
      </>
    )
  }
}
